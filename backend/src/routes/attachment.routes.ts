/**
 * Attachment Routes
 *
 * POST /api/attachments/upload   — upload a file, extract text, return { id, extractionStatus }
 * GET  /api/attachments/:id      — get attachment metadata (no file body)
 * DELETE /api/attachments/:id    — delete an attachment
 *
 * Upload uses multipart/form-data (via multer).
 * The extracted text is stored server-side — subsequent messages only need to
 * send the attachment `id` instead of the full base64 payload.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { ChatAttachmentService } from '../services/chat-attachment.service';
import { ValidationError, NotFoundError } from '../types/error';
import { isValidUUID } from '../validation/uuid';
import logger from '../config/logger';

const router = Router();

// Multer config — memory storage, 50 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

/**
 * POST /api/attachments/upload
 * Upload a single file. Extracts text and stores metadata.
 * Body (multipart): file (the attachment), conversationId? (optional)
 */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Optional conversation association
    const conversationId = req.body.conversationId;
    if (conversationId && !isValidUUID(conversationId)) {
      throw new ValidationError('Invalid conversationId');
    }

    const result = await ChatAttachmentService.upload(
      userId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      conversationId,
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * GET /api/attachments/:id
 * Get attachment metadata (not the file itself).
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const attachmentId = req.params.id;

    if (!isValidUUID(attachmentId)) {
      throw new ValidationError('Invalid attachment ID');
    }

    const results = await ChatAttachmentService.resolveByIds([attachmentId], userId);
    if (results.length === 0) {
      throw new NotFoundError('Attachment not found');
    }

    res.json({
      success: true,
      data: results[0],
    });
  }),
);

/**
 * DELETE /api/attachments/:id
 * Delete an attachment (DB row + storage file).
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const attachmentId = req.params.id;

    if (!isValidUUID(attachmentId)) {
      throw new ValidationError('Invalid attachment ID');
    }

    await ChatAttachmentService.delete(attachmentId, userId);

    res.json({
      success: true,
      data: { deleted: true },
    });
  }),
);

export default router;
