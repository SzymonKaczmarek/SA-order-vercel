export const DEFAULT_ADMINS = [
  {
    username: 'root',
    password:
      'szym.kaczmarek@gmail.comszym.kaczmarek@gmail.comszym.kaczmarek@gmail.com',
    role: 'admin',
    firstName: 'Szymon',
    lastName: 'Kaczmarek',
    email: 'szym.kaczmarek@gmail.com',
  },
  {
    username: 'marcin@kardas.pl',
    password: 'marcin@kardas@plmarcin@kardas@plmarcin@kardas@pl',
    role: 'admin',
    firstName: 'Marcin',
    lastName: 'Kardas',
    email: 'marcin@kardas.pl',
  },
];

export const DEFAULT_USER = DEFAULT_ADMINS[0];

export const USERS = [...DEFAULT_ADMINS];

const LEGACY_ADMIN_USERNAME = 'szym.kaczmarek@gmail.com';

export function findDefaultAdminCredentials(username, password) {
  const trimmedUsername = String(username || '').trim();

  const direct = DEFAULT_ADMINS.find(
    (item) => item.username === trimmedUsername && item.password === password
  );
  if (direct) {
    return direct;
  }

  if (
    trimmedUsername === LEGACY_ADMIN_USERNAME &&
    password === DEFAULT_USER.password
  ) {
    return DEFAULT_USER;
  }

  return null;
}

export function isDefaultAdminCredentials(username, password) {
  return Boolean(findDefaultAdminCredentials(username, password));
}

export function defaultAdminAuthPayload(username, password) {
  const admin = findDefaultAdminCredentials(username, password);
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
