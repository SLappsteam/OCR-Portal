import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

interface AuditEventParams {
  userId?: number;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: params.userId,
        user_email: params.userEmail,
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        details: params.details
          ? (params.details as Prisma.InputJsonValue)
          : undefined,
        ip_address: params.ipAddress,
      },
    });
  } catch (error) {
    // Audit logging should never break the request flow
    logger.error('Failed to write audit log', { error, params });
  }
}
