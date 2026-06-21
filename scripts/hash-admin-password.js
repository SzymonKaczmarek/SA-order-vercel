const { hashPasswordSha256 } = require('../lib/passwordHash');

const password = process.argv[2];

if (!password) {
  console.error('Użycie: node scripts/hash-admin-password.js "twoje-haslo"');
  process.exit(1);
}

console.log(hashPasswordSha256(password));
