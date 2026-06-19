import { useCallback, useEffect, useState } from 'react';
import {
  readAccessAccountUsers,
  readAccessAccountsStore,
  setActiveAccessAccount,
} from '../data/accessAccounts';
import { USERS } from '../data/users';

const STORAGE_KEY = 'saor_logged_user';

export const AUTH_STORAGE_KEY = STORAGE_KEY;

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function findAccessAccountUser(username, password) {
  if (typeof window === 'undefined') return null;

  const trimmedUsername = username.trim();
  const store = readAccessAccountsStore();

  for (const account of store.accounts) {
    const users = readAccessAccountUsers(account.id);
    const found = users.find(
      (item) => item.username === trimmedUsername && item.password === password
    );

    if (found) {
      return { account, user: found };
    }
  }

  return null;
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
        const payload = {
          username: data.username,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
        };
        persistLoggedUser(payload);
        setUser(payload);
        return true;
      }

      if (res.status === 401 || res.status === 400) {
        setError(data.error || 'Nieprawidłowy login lub hasło.');
        return false;
      }
    } catch (_e) {
      // API niedostępne – fallback lokalny
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
      return true;
    }

    setError('Nieprawidłowy login lub hasło.');
    return false;
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    login,
    logout,
    setError,
  };
}
