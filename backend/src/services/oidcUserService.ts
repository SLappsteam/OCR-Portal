import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { parseStoreFromDepartment } from './oidcService';

interface OidcUserClaims {
  oid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

function splitName(fullName: string | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!fullName) return { firstName: 'Unknown', lastName: 'User' };
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? 'Unknown';
  const lastName = parts.slice(1).join(' ') || 'User';
  return { firstName, lastName };
}

export async function findOrCreateOidcUser(
  claims: OidcUserClaims,
  department: string | undefined
) {
  const email = claims.email ?? claims.preferred_username;
  if (!email) {
    throw new Error('OIDC claims missing email and preferred_username');
  }

  let user = await prisma.user.findUnique({
    where: { oidc_subject_id: claims.oid },
  });

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (user) {
    const { firstName, lastName } = splitName(claims.name);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        oidc_subject_id: claims.oid,
        auth_provider: 'oidc',
        first_name: firstName,
        last_name: lastName,
      },
    });
    logger.info(`OIDC login: existing user ${email}`);
    return user;
  }

  const { firstName, lastName } = splitName(claims.name);

  user = await prisma.user.create({
    data: {
      email,
      first_name: firstName,
      last_name: lastName,
      auth_provider: 'oidc',
      oidc_subject_id: claims.oid,
      role: 'viewer',
      is_active: true,
      password_hash: null,
      last_login_at: new Date(),
    },
  });

  logger.info(`OIDC login: created new user ${email}`);

  await assignStoreFromDepartment(user.id, department);

  return user;
}

async function assignStoreFromDepartment(
  userId: number,
  department: string | undefined
): Promise<void> {
  const storeNumber = parseStoreFromDepartment(department);
  if (!storeNumber) return;

  const store = await prisma.store.findUnique({
    where: { store_number: storeNumber },
  });
  if (!store) {
    logger.warn(`OIDC auto-provision: store ${storeNumber} not found`);
    return;
  }

  await prisma.userStoreAccess.upsert({
    where: {
      user_id_store_id: { user_id: userId, store_id: store.id },
    },
    update: { can_view: true },
    create: {
      user_id: userId,
      store_id: store.id,
      can_view: true,
    },
  });

  logger.info(`OIDC auto-provision: assigned store ${storeNumber} to user ${userId}`);
}
