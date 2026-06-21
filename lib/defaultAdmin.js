const DEFAULT_ADMINS = [
  {
    username: 'root',
    password:
      'szym.kaczmarek@gmail.comszym.kaczmarek@gmail.comszym.kaczmarek@gmail.com',
  },
  {
    username: 'marcin@kardas.pl',
    password: 'marcin@kardas@plmarcin@kardas@plmarcin@kardas@pl',
  },
];

const LEGACY_ADMIN_USERNAME = 'szym.kaczmarek@gmail.com';
const LEGACY_ADMIN_PASSWORD = DEFAULT_ADMINS[0].password;

function isDefaultAdminCredentials(username, password) {
  const trimmed = String(username || '').trim();

  const direct = DEFAULT_ADMINS.find(
    (item) => item.username === trimmed && item.password === password
  );
  if (direct) {
    return true;
  }

  if (trimmed === LEGACY_ADMIN_USERNAME && password === LEGACY_ADMIN_PASSWORD) {
    return true;
  }

  return false;
}

module.exports = {
  isDefaultAdminCredentials,
};
