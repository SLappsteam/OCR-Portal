import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { clearStorageFiles } from '../services/storageService';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { BadRequestError } from '../middleware/errorHandler';
import { hasClientSecret } from '../services/oidcService';
import { encryptSecret } from '../utils/oidcCrypto';

const router = Router();

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SettingsResponse {
  watcherStatus: 'running' | 'stopped';
}

let watcherRunning = false;

export function setWatcherStatus(running: boolean): void {
  watcherRunning = running;
}

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings: SettingsResponse = {
      watcherStatus: watcherRunning ? 'running' : 'stopped',
    };

    const response: ApiResponse<SettingsResponse> = {
      success: true,
      data: settings,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/clear-data', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedDocs = await prisma.document.deleteMany({});
    const deletedBatches = await prisma.batch.deleteMany({});
    await clearStorageFiles();

    logger.info(
      `Cleared data: ${deletedDocs.count} documents, ${deletedBatches.count} batches, storage files removed`
    );

    const response: ApiResponse<{ documents: number; batches: number }> = {
      success: true,
      data: {
        documents: deletedDocs.count,
        batches: deletedBatches.count,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/oidc', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.appSetting.findMany({
      where: {
        key: { in: ['oidc_enabled', 'oidc_tenant_id', 'oidc_client_id'] },
      },
    });

    const settingsMap = new Map(rows.map((r) => [r.key, r.value]));
    const secretConfigured = await hasClientSecret();

    res.json({
      success: true,
      data: {
        enabled: settingsMap.get('oidc_enabled') === 'true',
        tenantId: settingsMap.get('oidc_tenant_id') ?? '',
        clientId: settingsMap.get('oidc_client_id') ?? '',
        hasClientSecret: secretConfigured,
      },
    });
  } catch (error) {
    next(error);
  }
});

const oidcUpdateSchema = z.object({
  enabled: z.boolean(),
  tenantId: z.string(),
  clientId: z.string(),
  clientSecret: z.string().optional(),
});

router.patch('/oidc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = oidcUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid OIDC settings');
    }

    const { enabled, tenantId, clientId, clientSecret } = parsed.data;

    if (enabled) {
      if (!GUID_REGEX.test(tenantId)) {
        throw new BadRequestError('Tenant ID must be a valid GUID');
      }
      if (!GUID_REGEX.test(clientId)) {
        throw new BadRequestError('Client ID must be a valid GUID');
      }
      const willHaveSecret = clientSecret || (await hasClientSecret());
      if (!willHaveSecret) {
        throw new BadRequestError(
          'A client secret is required to enable OIDC'
        );
      }
    }

    const upserts = [
      prisma.appSetting.upsert({
        where: { key: 'oidc_enabled' },
        update: { value: String(enabled) },
        create: { key: 'oidc_enabled', value: String(enabled) },
      }),
      prisma.appSetting.upsert({
        where: { key: 'oidc_tenant_id' },
        update: { value: tenantId },
        create: { key: 'oidc_tenant_id', value: tenantId },
      }),
      prisma.appSetting.upsert({
        where: { key: 'oidc_client_id' },
        update: { value: clientId },
        create: { key: 'oidc_client_id', value: clientId },
      }),
    ];

    if (clientSecret) {
      const encrypted = encryptSecret(clientSecret);
      upserts.push(
        prisma.appSetting.upsert({
          where: { key: 'oidc_client_secret_enc' },
          update: { value: encrypted },
          create: { key: 'oidc_client_secret_enc', value: encrypted },
        })
      );
    }

    await prisma.$transaction(upserts);

    logger.info(`OIDC settings updated: enabled=${enabled}`);
    res.json({ success: true, data: { enabled, tenantId, clientId } });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/oidc/test',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantRow = await prisma.appSetting.findUnique({
        where: { key: 'oidc_tenant_id' },
      });

      const tenantId = tenantRow?.value;
      if (!tenantId) {
        throw new BadRequestError('Tenant ID is not configured');
      }

      const discoveryUrl =
        `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;

      const response = await fetch(discoveryUrl);
      if (!response.ok) {
        res.json({
          success: true,
          data: {
            status: 'error',
            message: `Discovery endpoint returned ${response.status}`,
          },
        });
        return;
      }

      const discovery = await response.json();
      res.json({
        success: true,
        data: {
          status: 'ok',
          issuer: (discovery as { issuer?: string }).issuer,
          message: 'OIDC discovery successful',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
