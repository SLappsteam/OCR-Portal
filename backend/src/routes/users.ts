import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { ApiResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { ROLE_HIERARCHY } from '../utils/authConstants';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';

const router = Router();

const VALID_ROLES = Object.keys(ROLE_HIERARCHY);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        auth_provider: true,
        last_login_at: true,
        storeAccess: {
          include: { store: { select: { id: true, store_number: true, name: true } } },
        },
      },
      orderBy: { email: 'asc' },
    });

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      isActive: u.is_active,
      authProvider: u.auth_provider,
      lastLoginAt: u.last_login_at,
      stores: u.storeAccess.map((sa) => ({
        storeId: sa.store.id,
        storeNumber: sa.store.store_number,
        storeName: sa.store.name,
        canView: sa.can_view,
        canUpload: sa.can_upload,
        canEdit: sa.can_edit,
      })),
    }));

    const response: ApiResponse = { success: true, data };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

const storeAssignmentSchema = z.object({
  stores: z.array(
    z.object({
      storeId: z.number().int().positive(),
      canView: z.boolean().default(true),
      canUpload: z.boolean().default(false),
      canEdit: z.boolean().default(false),
    })
  ),
});

router.patch(
  '/:id/stores',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params['id'] ?? '', 10);
      if (isNaN(userId)) throw new BadRequestError('Invalid user ID');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      const parsed = storeAssignmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid request');
      }

      await prisma.$transaction(async (tx) => {
        await tx.userStoreAccess.deleteMany({ where: { user_id: userId } });

        if (parsed.data.stores.length > 0) {
          await tx.userStoreAccess.createMany({
            data: parsed.data.stores.map((s) => ({
              user_id: userId,
              store_id: s.storeId,
              can_view: s.canView,
              can_upload: s.canUpload,
              can_edit: s.canEdit,
            })),
          });
        }
      });

      logger.info(`User ${userId} store access updated`);
      void logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        action: 'user.update_stores',
        resourceType: 'user',
        resourceId: String(userId),
        details: { stores: parsed.data.stores },
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Store access updated' });
    } catch (error) {
      next(error);
    }
  }
);

const roleUpdateSchema = z.object({
  role: z.string().refine((r) => VALID_ROLES.includes(r), {
    message: 'Invalid role',
  }),
});

router.patch(
  '/:id/role',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params['id'] ?? '', 10);
      if (isNaN(userId)) throw new BadRequestError('Invalid user ID');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      const parsed = roleUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid role');
      }

      await prisma.user.update({
        where: { id: userId },
        data: { role: parsed.data.role },
      });

      logger.info(`User ${userId} role changed to ${parsed.data.role}`);
      void logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        action: 'user.update_role',
        resourceType: 'user',
        resourceId: String(userId),
        details: { oldRole: user.role, newRole: parsed.data.role },
        ipAddress: req.ip,
      });
      res.json({ success: true, message: 'Role updated' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
