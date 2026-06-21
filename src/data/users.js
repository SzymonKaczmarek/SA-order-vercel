import {
  DEFAULT_ADMIN_RECORDS,
  LEGACY_ADMIN_USERNAME,
} from '../../lib/defaultAdmins.config';
import { verifyPasswordSha256 } from '../utils/passwordHash';

export { LEGACY_ADMIN_USERNAME };

export const DEFAULT_ADMINS = DEFAULT_ADMIN_RECORDS.map(({ passwordHash, ...profile }) => ({
  ...profile,
}));

export const DEFAULT_USER = DEFAULT_ADMINS[0];

/** Publiczne profile — bez haseł i hashy. */
export const USERS = [...DEFAULT_ADMINS];

async function matchesAdminRecord(record, username, password) {
  if (!record || record.username !== username) {
    return false;
  }

  return verifyPasswordSha256(password, record.passwordHash);
}

export async function findDefaultAdminCredentials(username, password) {
  const trimmedUsername = String(username || '').trim();

  for (const record of DEFAULT_ADMIN_RECORDS) {
    if (await matchesAdminRecord(record, trimmedUsername, password)) {
      return record;
    }
  }

  const primary = DEFAULT_ADMIN_RECORDS[0];
  if (
    primary &&
    trimmedUsername === LEGACY_ADMIN_USERNAME &&
    (await verifyPasswordSha256(password, primary.passwordHash))
  ) {
    return primary;
  }

  return null;
}

export async function isDefaultAdminCredentials(username, password) {
  return Boolean(await findDefaultAdminCredentials(username, password));
}

export async function defaultAdminAuthPayload(username, password) {
  const admin = await findDefaultAdminCredentials(username, password);
  if (!admin) {
    return null;
  }

  return {
    username: admin.username,
    role: admin.role,
    firstName: admin.firstName,
    lastName: admin.lastName,
    email: admin.email,
  };
}
