const crypto = require('crypto');

function hashPasswordSha256(password) {
  return crypto.createHash('sha256').update(String(password || ''), 'utf8').digest('hex');
}

function verifyPasswordSha256(password, expectedHash) {
  if (!expectedHash) {
    return false;
  }

  const actual = hashPasswordSha256(password);
  const left = Buffer.from(actual, 'utf8');
  const right = Buffer.from(String(expectedHash), 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

module.exports = {
  hashPasswordSha256,
  verifyPasswordSha256,
};
