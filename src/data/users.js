export const DEFAULT_USER = {
  username: 'szym.kaczmarek@gmail.com',
  password: 'szym.kaczmarek@gmail.comszym.kaczmarek@gmail.comszym.kaczmarek@gmail.com',
  role: 'admin',
  firstName: 'Szymon',
  lastName: 'Kaczmarek',
  email: 'szym.kaczmarek@gmail.com',
};

export const USERS = [DEFAULT_USER];

export function isDefaultAdminCredentials(username, password) {
  const trimmedUsername = String(username || '').trim();
  return (
    trimmedUsername === DEFAULT_USER.username && password === DEFAULT_USER.password
  );
}
