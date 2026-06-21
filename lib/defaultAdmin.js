const { DEFAULT_ADMIN_RECORDS, LEGACY_ADMIN_USERNAME } = require('./defaultAdmins.config');
const { verifyPasswordSha256 } = require('./passwordHash');

function matchesAdminRecord(record, username, password) {
  if (!record || record.username !== username) {
    return false;
  }

  return verifyPasswordSha256(password, record.passwordHash);
}

function findDefaultAdminRecord(username, password) {
  const trimmedUsername = String(username || '').trim();

  const direct = DEFAULT_ADMIN_RECORDS.find((item) =>
    matchesAdminRecord(item, trimmedUsername, password)
  );
  if (direct) {
    return direct;
  }

  const primary = DEFAULT_ADMIN_RECORDS[0];
  if (
    primary &&
    trimmedUsername === LEGACY_ADMIN_USERNAME &&
    verifyPasswordSha256(password, primary.passwordHash)
  ) {
    return primary;
  }

  return null;
}

function isDefaultAdminCredentials(username, password) {
  return Boolean(findDefaultAdminRecord(username, password));
}

module.exports = {
  isDefaultAdminCredentials,
  findDefaultAdminRecord,
};
