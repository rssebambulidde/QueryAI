import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { EnterpriseService } from '../services/enterprise.service';

const router = Router();

/**
 * POST /api/enterprise/inquiry
 * Submit enterprise contact-sales form. Public (no auth).
 */
router.post(
  '/inquiry',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, company, message } = req.body;
    if (!name || !email || typeof name !== 'string' || typeof email !== 'string') {
      throw new ValidationError('name and email are required');
    }
    const inquiry = await EnterpriseService.submitEnterpriseInquiry({
      name,
      email,
      company,
      message,
    });
    if (!inquiry) {
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to submit inquiry', code: 'INQUIRY_FAILED' },
      });
    }
    return res.status(200).json({
      success: true,
      data: { id: inquiry.id, message: 'Thank you. We will contact you soon.' },
    });
  })
);

/**
 * GET /api/enterprise/teams
 * List teams the user belongs to. Requires auth and enterprise tier.
 */
router.get(
  '/teams',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const hasAccess = await EnterpriseService.ensureUserHasEnterpriseAccess(userId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { message: 'Enterprise access required', code: 'ENTERPRISE_REQUIRED' },
      });
    }
    const teams = await EnterpriseService.listTeamsForUser(userId);
    return res.status(200).json({ success: true, data: { teams } });
  })
);

/**
 * POST /api/enterprise/teams
 * Create a team. Requires auth and enterprise tier.
 */
router.post(
  '/teams',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string') {
      throw new ValidationError('name is required');
    }
    const s = slug ?? name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const team = await EnterpriseService.createTeam(userId, name, s);
    if (!team) {
      return res.status(403).json({
        success: false,
        error: { message: 'Enterprise access required or invalid slug', code: 'CREATE_FAILED' },
      });
    }
    return res.status(201).json({ success: true, data: { team } });
  })
);

export default router;
