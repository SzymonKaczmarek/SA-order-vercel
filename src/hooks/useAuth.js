import { useCallback, useEffect, useState } from 'react';
import {
  findAccessAccountByCredentials,
  setActiveAccessAccount,
  writeAccessStoreSnapshot,
} from '../data/accessAccounts';
import { USERS, defaultAdminAuthPayload } from '../data/users';
import { getAccessStoreFromDb } from '../hooks/useAppDbApi';
import { logEvent } from '../utils/eventLog';

const STORAGE_KEY = 'saor_logged_user';

export const AUTH_STORAGE_KEY = STORAGE_KEY;

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function findAccessAccountUser(username, password) {
  return findAccessAccountByCredentials(username, password);
}

function accountToLoginPayload(account) {
  return {
    username: account.username,
    role: account.role || 'user',
    firstName: account.name || account.username,
    lastName: '',
    email: account.email || account.username,
    accessAccountId: account.id,
  };
}

async function findAccountOnServer(username, password) {
  const trimmed = String(username || '').trim();
  const store = await getAccessStoreFromDb();
  const accounts = Array.isArray(store?.accounts) ? store.accounts : [];
  const account = accounts.find(
    (item) => item.username === trimmed && item.password === password
  );
  if (!account) {
    return null;
  }

  writeAccessStoreSnapshot({
    accounts: store.accounts,
    activeId: account.id,
    users: store.users,
  });

  return accountToLoginPayload(account);
}

function persistLoggedUser(payload) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function useAuthInternal() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setLoading(false);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.username) {
        setUser(parsed);
      }
    } catch (_e) {
      // ignorujemy błędy parsowania
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    setError('');

    try {
      const res = await fetch(`${getBaseUrl()}/.netlify/functions/auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.username) {
        if (data.accessAccountId) {
          setActiveAccessAccount(data.accessAccountId);
          try {
            const store = await getAccessStoreFromDb();
            if (store && Array.isArray(store.accounts) && store.accounts.length > 0) {
              writeAccessStoreSnapshot({
                accounts: store.accounts,
                activeId: data.accessAccountId,
                users: store.users,
              });
            }
          } catch (_e) {
            // bootstrap uzupełni po zalogowaniu
          }
        }

        const payload = {
          username: data.username,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          accessAccountId: data.accessAccountId || null,
        };
        persistLoggedUser(payload);
        setUser(payload);
        logEvent({
          level: 'info',
          category: 'auth',
          action: 'auth.login.success',
          message: `Logowanie: ${payload.username}`,
          details: { role: payload.role, accessAccountId: payload.accessAccountId },
        });
        return true;
      }

      if (res.status === 400) {
        logEvent({
          level: 'warn',
          category: 'auth',
          action: 'auth.login.failed',
          message: 'Nieudane logowanie',
          details: { username: username.trim(), error: data.error },
        });
        setError(data.error || 'Nieprawidłowy login lub hasło.');
        return false;
      }

      if (!res.ok) {
        try {
          const serverAccount = await findAccountOnServer(username, password);
          if (serverAccount) {
            setActiveAccessAccount(serverAccount.accessAccountId);
            persistLoggedUser(serverAccount);
            setUser(serverAccount);
            logEvent({
              level: 'info',
              category: 'auth',
              action: 'auth.login.success',
              message: `Logowanie (baza serwerowa): ${serverAccount.username}`,
              details: {
                role: serverAccount.role,
                accessAccountId: serverAccount.accessAccountId,
              },
            });
            return true;
          }
        } catch (_serverErr) {
          // próbujemy dalej lokalnie
        }
      }
    } catch (_e) {
      // API niedostępne – fallback lokalny / serwerowy
      try {
        const serverAccount = await findAccountOnServer(username, password);
        if (serverAccount) {
          setActiveAccessAccount(serverAccount.accessAccountId);
          persistLoggedUser(serverAccount);
          setUser(serverAccount);
          logEvent({
            level: 'info',
            category: 'auth',
            action: 'auth.login.success',
            message: `Logowanie (baza serwerowa): ${serverAccount.username}`,
            details: {
              role: serverAccount.role,
              accessAccountId: serverAccount.accessAccountId,
            },
          });
          return true;
        }
      } catch (_serverErr) {
        // fallback lokalny poniżej
      }
    }

    const adminPayload = defaultAdminAuthPayload(username, password);
    if (adminPayload) {
      persistLoggedUser(adminPayload);
      setUser(adminPayload);
      logEvent({
        level: 'info',
        category: 'auth',
        action: 'auth.login.success',
        message: `Logowanie (admin): ${adminPayload.username}`,
        details: { role: adminPayload.role },
      });
      return true;
    }

    const found = USERS.find(
      (u) => u.username === username.trim() && u.password === password
    );

    if (found) {
      const payload = {
        username: found.username,
        role: found.role,
        firstName: found.firstName,
        lastName: found.lastName,
        email: found.email,
      };

      persistLoggedUser(payload);
      setUser(payload);
      logEvent({
        level: 'info',
        category: 'auth',
        action: 'auth.login.success',
        message: `Logowanie (lokalne): ${payload.username}`,
        details: { role: payload.role },
      });
      return true;
    }

    const accessMatch = findAccessAccountUser(username, password);

    if (accessMatch) {
      setActiveAccessAccount(accessMatch.account.id);

      const payload = {
        username: accessMatch.user.username,
        role: accessMatch.user.role || 'user',
        firstName: accessMatch.user.firstName,
        lastName: accessMatch.user.lastName,
        email: accessMatch.user.email,
        accessAccountId: accessMatch.account.id,
      };

      persistLoggedUser(payload);
      setUser(payload);
      logEvent({
        level: 'info',
        category: 'auth',
        action: 'auth.login.success',
        message: `Logowanie kontem: ${payload.username}`,
        details: {
          role: payload.role,
          accessAccountId: payload.accessAccountId,
          accountName: accessMatch.account.name,
        },
      });
      return true;
    }

    logEvent({
      level: 'warn',
      category: 'auth',
      action: 'auth.login.failed',
      message: 'Nieudane logowanie',
      details: { username: username.trim() },
    });
    setError('Nieprawidłowy login lub hasło.');
    return false;
  }, []);

  const logout = useCallback(() => {
    if (user?.username) {
      logEvent({
        level: 'info',
        category: 'auth',
        action: 'auth.logout',
        message: `Wylogowanie: ${user.username}`,
      });
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
  }, [user]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    setError,
  };
}
