/**
 * Document Routes
 *
 * Thin route definitions + middleware chains.
 * All handler logic lives in document.controller.ts;
 * all business logic lives in document-processing.service.ts.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { apiLimiter } from '../middleware/rateLimiter';
import { enforceDocumentUploadLimit, requireFeature } from '../middleware/subscription.middleware';
import { logDocumentUploadUsage } from '../middleware/usageCounter.middleware';
import { tierRateLimiter } from '../middleware/tierRateLimiter.middleware';
import { validateUUIDParams } from '../validation/uuid';
import { ValidationError } from '../types/error';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from '../services/document-processing.service';
import * as ctrl from '../controllers/document.controller';

// ---------------------------------------------------------------------------
// Multer setup
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(ext);
    return ok ? cb(null, true) : cb(new ValidationError('Unsupported file type. Allowed: PDF, TXT, MD, DOCX.'));
  },
});

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new ValidationError('File too large. Maximum size is 10MB.'));
    }
    return next(err instanceof multer.MulterError ? new ValidationError(err.message) : err);
  });
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ── Upload ────────────────────────────────────────────────────────────────
router.post(
  '/upload',
  authenticate, tierRateLimiter, requireFeature('documentUpload'),
  enforceDocumentUploadLimit, handleUpload, logDocumentUploadUsage,
  asyncHandler(ctrl.uploadDocument),
);

// ── List / Download ───────────────────────────────────────────────────────
router.get('/',         authenticate, asyncHandler(ctrl.getDocuments));
router.get('/download', authenticate, asyncHandler(ctrl.downloadDocument));

// ── Batch operations ──────────────────────────────────────────────────────
router.post('/batch-extract', authenticate, apiLimiter, asyncHandler(ctrl.batchExtract));
router.post('/batch-embed',   authenticate, apiLimiter, asyncHandler(ctrl.batchEmbed));

// ── Sync legacy storage documents ─────────────────────────────────────────
router.post('/sync', authenticate, asyncHandler(ctrl.syncDocuments));

// ── Single-document operations (require UUID `:id`) ───────────────────────
router.get(  '/:id/text',             authenticate, validateUUIDParams('id'), asyncHandler(ctrl.getDocumentText));
router.get(  '/:id/status',           authenticate, validateUUIDParams('id'), asyncHandler(ctrl.getDocumentStatus));
router.patch('/:id',                  authenticate, validateUUIDParams('id'), asyncHandler(ctrl.updateDocumentMetadata));
router.post( '/:id/extract',          authenticate, validateUUIDParams('id'), asyncHandler(ctrl.extractDocument));
router.post( '/:id/process',          authenticate, validateUUIDParams('id'), apiLimiter, asyncHandler(ctrl.processDocument));
router.post( '/:id/clear-processing', authenticate, validateUUIDParams('id'), apiLimiter, asyncHandler(ctrl.clearDocumentProcessing));

// ── Delete ────────────────────────────────────────────────────────────────
router.delete('/', authenticate, asyncHandler(ctrl.deleteDocument));

export default router;
