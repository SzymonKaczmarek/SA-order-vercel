const ACCOUNTS_KEY = 'saor_access_accounts';
const USERS_KEY = 'saor_access_account_users';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

function generateId() {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function readAccessAccountsStore() {
  if (typeof window === 'undefined') {
    return { accounts: [], activeId: null };
  }

  const data = safeParse(window.localStorage.getItem(ACCOUNTS_KEY), {
    accounts: [],
    activeId: null,
  });

  return {
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    activeId: data.activeId || null,
  };
}

function writeAccessAccountsStore(store) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
}

export function readAccessAccountUsers(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) return [];

  const all = safeParse(window.localStorage.getItem(USERS_KEY), {});
  return Array.isArray(all[accessAccountId]) ? all[accessAccountId] : [];
}

function writeAccessAccountUsers(accessAccountId, users) {
  if (typeof window === 'undefined' || !accessAccountId) return;

  const all = safeParse(window.localStorage.getItem(USERS_KEY), {});
  all[accessAccountId] = users;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(all));
}

export function getActiveAccessAccount() {
  const store = readAccessAccountsStore();
  if (!store.activeId) return null;
  return store.accounts.find((item) => item.id === store.activeId) || null;
}

export function formatAccessAccountLabel(account) {
  if (!account) return '—';

  if (account.name && account.name !== account.email) {
    return `${account.email} · ${account.name}`;
  }

  return account.email;
}

export function formatAccessAccountHeader(account) {
  if (!account) return 'Konto dostępu: —';
  return `Konto dostępu: ${formatAccessAccountLabel(account)}`;
}

export function setActiveAccessAccount(accessAccountId) {
  const store = readAccessAccountsStore();
  if (!store.accounts.some((item) => item.id === accessAccountId)) {
    return null;
  }

  const next = { ...store, activeId: accessAccountId };
  writeAccessAccountsStore(next);
  return next.accounts.find((item) => item.id === accessAccountId);
}

export function createAccessAccount({ email, name }) {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedName = String(name || '').trim();

  if (!trimmedEmail) {
    throw new Error('Podaj adres e-mail konta dostępu.');
  }

  const store = readAccessAccountsStore();
  if (store.accounts.some((item) => item.email === trimmedEmail)) {
    throw new Error('Konto z tym adresem e-mail już istnieje.');
  }

  const account = {
    id: generateId(),
    email: trimmedEmail,
    name: trimmedName || trimmedEmail,
    createdAt: new Date().toISOString(),
  };

  const next = {
    accounts: [...store.accounts, account],
    activeId: store.activeId || account.id,
  };

  writeAccessAccountsStore(next);
  writeAccessAccountUsers(account.id, []);
  return account;
}

export function addAccessAccountUser(accessAccountId, user) {
  const username = String(user.username || '').trim();
  const password = String(user.password || '');
  const email = String(user.email || '').trim().toLowerCase();
  const firstName = String(user.firstName || '').trim();
  const lastName = String(user.lastName || '').trim();

  if (!username || !password || !email) {
    throw new Error('Podaj login, hasło i e-mail użytkownika.');
  }

  const users = readAccessAccountUsers(accessAccountId);
  if (users.some((item) => item.username === username)) {
    throw new Error('Użytkownik o tym loginie już istnieje w tym koncie.');
  }

  const entry = {
    username,
    password,
    email,
    firstName: firstName || username,
    lastName: lastName || '',
    role: user.role || 'user',
  };

  writeAccessAccountUsers(accessAccountId, [...users, entry]);
  return entry;
}

export function ensureDefaultAccessAccount(seedEmail) {
  const store = readAccessAccountsStore();
  if (store.accounts.length > 0) {
    if (!store.activeId && store.accounts[0]) {
      setActiveAccessAccount(store.accounts[0].id);
    }
    return getActiveAccessAccount();
  }

  const email = String(seedEmail || 'admin@example.com').trim().toLowerCase();
  const account = createAccessAccount({
    email,
    name: 'Konto domyślne',
  });

  addAccessAccountUser(account.id, {
    username: 'admin',
    password: 'admin123',
    email,
    firstName: 'Admin',
    lastName: 'Demo',
    role: 'admin',
  });

  setActiveAccessAccount(account.id);
  return account;
}
