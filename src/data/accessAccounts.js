import { DEFAULT_USER } from './users';

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

function readLegacyUsersMap() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(USERS_KEY), {});
}

function migrateLegacyAccountCredentials(account, usersMap) {
  let next = account;

  if (!next.username || !next.password) {
    const legacyUsers = Array.isArray(usersMap[account.id]) ? usersMap[account.id] : [];
    if (legacyUsers.length > 0) {
      const primary = legacyUsers[0];
      next = {
        ...next,
        username: String(primary.username || '').trim(),
        password: String(primary.password || ''),
        email: String(primary.email || account.email || '').trim(),
      };
    }
  }

  if (
    next.username === 'skaczmarek' &&
    next.password === DEFAULT_USER.password
  ) {
    next = { ...next, username: DEFAULT_USER.username };
  }

  return next;
}

function migrateAccountsStore(store) {
  const usersMap = readLegacyUsersMap();
  let changed = false;

  const accounts = store.accounts.map((account) => {
    const migrated = migrateLegacyAccountCredentials(account, usersMap);
    if (JSON.stringify(migrated) !== JSON.stringify(account)) {
      changed = true;
    }
    return migrated;
  });

  if (!changed) {
    return store;
  }

  const next = { ...store, accounts };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  }
  return next;
}

export function readAccessAccountsStore() {
  if (typeof window === 'undefined') {
    return { accounts: [], activeId: null };
  }

  const data = safeParse(window.localStorage.getItem(ACCOUNTS_KEY), {
    accounts: [],
    activeId: null,
  });

  const store = {
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    activeId: data.activeId || null,
  };

  return migrateAccountsStore(store);
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

export function writeAccessStoreSnapshot({ accounts, activeId, users }) {
  if (typeof window === 'undefined') return;

  const usersMap = users && typeof users === 'object' ? users : {};
  window.localStorage.setItem(USERS_KEY, JSON.stringify(usersMap));

  writeAccessAccountsStore({
    accounts: Array.isArray(accounts) ? accounts : [],
    activeId: activeId || null,
  });

  readAccessAccountsStore();
}

export function readAccessUsersMap() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(USERS_KEY), {});
}

export function getAccessStoreSnapshot() {
  const store = readAccessAccountsStore();
  return {
    accounts: store.accounts,
    activeId: store.activeId,
    users: readAccessUsersMap(),
    syncedAt: new Date().toISOString(),
  };
}

export function getActiveAccessAccount() {
  const store = readAccessAccountsStore();
  if (!store.activeId) return null;
  return store.accounts.find((item) => item.id === store.activeId) || null;
}

export function getAccessAccountDisplayName(account) {
  if (!account) return '—';
  const name = String(account.name || '').trim();
  if (name) return name;
  const username = String(account.username || '').trim();
  return username || '—';
}

export function formatAccessAccountLabel(account) {
  return getAccessAccountDisplayName(account);
}

export function formatAccessAccountHeader(account) {
  if (!account) return 'Konto: —';
  return `Konto: ${getAccessAccountDisplayName(account)}`;
}

export function isUsernameTaken(username, exceptAccountId = null) {
  const trimmed = String(username || '').trim();
  if (!trimmed) return false;

  const store = readAccessAccountsStore();
  return store.accounts.some(
    (item) => item.username === trimmed && item.id !== exceptAccountId
  );
}

export function accountToAuthUser(account) {
  return {
    username: account.username,
    password: account.password,
    email: account.email || account.username,
    firstName: account.name || account.username,
    lastName: '',
    role: account.role || 'user',
  };
}

export function findAccessAccountByCredentials(username, password) {
  const trimmedUsername = String(username || '').trim();
  const store = readAccessAccountsStore();

  const account = store.accounts.find(
    (item) => item.username === trimmedUsername && item.password === password
  );

  if (!account) {
    return null;
  }

  return {
    account,
    user: accountToAuthUser(account),
  };
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

export function createAccessAccount({ name, username, password }) {
  const trimmedName = String(name || '').trim();
  const trimmedUsername = String(username || '').trim();
  const trimmedPassword = String(password || '');

  if (!trimmedName) {
    throw new Error('Podaj nazwę konta.');
  }

  if (!trimmedUsername) {
    throw new Error('Podaj login do panelu.');
  }

  if (!trimmedPassword) {
    throw new Error('Podaj hasło do panelu.');
  }

  if (isUsernameTaken(trimmedUsername)) {
    throw new Error('Ten login jest już zajęty.');
  }

  const store = readAccessAccountsStore();
  const normalizedName = trimmedName.toLowerCase();
  if (
    store.accounts.some(
      (item) => getAccessAccountDisplayName(item).toLowerCase() === normalizedName
    )
  ) {
    throw new Error('Konto o tej nazwie już istnieje.');
  }

  const account = {
    id: generateId(),
    name: trimmedName,
    username: trimmedUsername,
    password: trimmedPassword,
    email: '',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  const next = {
    accounts: [...store.accounts, account],
    activeId: store.activeId || account.id,
  };

  writeAccessAccountsStore(next);
  return account;
}

export function updateAccessAccount(accountId, { name, username, password }) {
  const store = readAccessAccountsStore();
  const index = store.accounts.findIndex((item) => item.id === accountId);

  if (index === -1) {
    throw new Error('Nie znaleziono konta.');
  }

  const current = store.accounts[index];
  const trimmedName = String(name || '').trim();
  const trimmedUsername = String(username || '').trim();
  const nextPassword =
    password !== undefined && String(password).length > 0
      ? String(password)
      : current.password;

  if (!trimmedName) {
    throw new Error('Podaj nazwę konta.');
  }

  if (!trimmedUsername) {
    throw new Error('Podaj login do panelu.');
  }

  if (!nextPassword) {
    throw new Error('Podaj hasło do panelu.');
  }

  if (isUsernameTaken(trimmedUsername, accountId)) {
    throw new Error('Ten login jest już zajęty.');
  }

  const normalizedName = trimmedName.toLowerCase();
  if (
    store.accounts.some(
      (item) =>
        item.id !== accountId &&
        getAccessAccountDisplayName(item).toLowerCase() === normalizedName
    )
  ) {
    throw new Error('Konto o tej nazwie już istnieje.');
  }

  const updated = {
    ...current,
    name: trimmedName,
    username: trimmedUsername,
    password: nextPassword,
  };

  const accounts = [...store.accounts];
  accounts[index] = updated;
  writeAccessAccountsStore({ ...store, accounts });
  return updated;
}

export function deleteAccessAccount(accountId) {
  const store = readAccessAccountsStore();

  if (store.accounts.length <= 1) {
    throw new Error('Nie można usunąć ostatniego konta.');
  }

  const deletedAccount = store.accounts.find((item) => item.id === accountId);
  if (!deletedAccount) {
    throw new Error('Nie znaleziono konta.');
  }

  const accounts = store.accounts.filter((item) => item.id !== accountId);
  const activeId = store.activeId === accountId ? accounts[0]?.id || null : store.activeId;

  writeAccessAccountsStore({ accounts, activeId });

  if (typeof window !== 'undefined') {
    const usersMap = readLegacyUsersMap();
    if (usersMap[accountId]) {
      delete usersMap[accountId];
      window.localStorage.setItem(USERS_KEY, JSON.stringify(usersMap));
    }
  }

  return { deletedAccount, activeId };
}

export function ensureDefaultAccessAccount() {
  const store = readAccessAccountsStore();
  if (store.accounts.length > 0) {
    if (!store.activeId && store.accounts[0]) {
      setActiveAccessAccount(store.accounts[0].id);
    }
    return getActiveAccessAccount();
  }

  const account = createAccessAccount({
    name: 'Konto domyślne',
    username: DEFAULT_USER.username,
    password: DEFAULT_USER.password,
  });

  const storeAfter = readAccessAccountsStore();
  const accounts = storeAfter.accounts.map((item) =>
    item.id === account.id ? { ...item, role: DEFAULT_USER.role } : item
  );
  writeAccessAccountsStore({ ...storeAfter, accounts, activeId: account.id });

  return getActiveAccessAccount();
}
