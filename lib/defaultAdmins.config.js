/** Profile domyślnych adminów — bez haseł w plain text (tylko passwordHash). */
const LEGACY_ADMIN_USERNAME = 'szym.kaczmarek@gmail.com';

const DEFAULT_ADMIN_RECORDS = [
  {
    username: 'skaczmarek',
    passwordHash: '698fa99b791432a28e61992957bf983d5afc305b23d39495f76cf5325af384b4',
    role: 'admin',
    firstName: 'Szymon',
    lastName: 'Kaczmarek',
    email: 'szym.kaczmarek@gmail.com',
  },
];

module.exports = {
  LEGACY_ADMIN_USERNAME,
  DEFAULT_ADMIN_RECORDS,
};
