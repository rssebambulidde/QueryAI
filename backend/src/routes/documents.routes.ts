import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { StorageService } from '../services/storage.service';
import { ValidationError } from '../types/error';
import logger from '../config/logger';

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed =
      ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(extension);
    if (!isAllowed) {
      return cb(new ValidationError('Unsupported file type. Allowed: PDF, TXT, MD, DOCX.'));
    }
    return cb(null, true);
  },
});

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File too large. Maximum size is 10MB.'));
      }
      return next(new ValidationError(err.message));
    }
    return next(err);
  });
};

/**
 * POST /api/documents/upload
 * Upload a document to Supabase Storage
 */
router.post(
  '/upload',
  authenticate,
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    if (!req.file) {
      throw new ValidationError('File is required');
    }

    const document = await StorageService.uploadDocument(userId, req.file);

    logger.info('Document uploaded', {
      userId,
      filePath: document.path,
      size: document.size,
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    });
  })
);

/**
 * GET /api/documents
 * List documents for the current user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const documents = await StorageService.listDocuments(userId);

    res.status(200).json({
      success: true,
      data: documents,
    });
  })
);

/**
 * DELETE /api/documents
 * Delete a document by path
 */
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { path: filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path is required');
    }

    await StorageService.deleteDocument(userId, filePath);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  })
);

export default router;
