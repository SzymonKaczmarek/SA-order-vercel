import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createAccessAccount,
  deleteAccessAccount,
  ensureDefaultAccessAccount,
  getActiveAccessAccount,
  readAccessAccountsStore,
  setActiveAccessAccount,
  updateAccessAccount,
  writeAccessStoreSnapshot,
} from '../data/accessAccounts';
import { getAccessStoreFromDb, setAccessStoreToDb } from '../hooks/useAppDbApi';
import { logEvent } from '../utils/eventLog';
import { useAuth } from './AuthContext';

const AccessAccountContext = createContext(null);

export function AccessAccountProvider({ children }) {
  const { user } = useAuth();
  const [store, setStore] = useState({ accounts: [], activeId: null });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setStore(readAccessAccountsStore());
  }, []);

  const syncCurrentStoreToDb = useCallback(async () => {
    const local = readAccessAccountsStore();
    try {
      await setAccessStoreToDb({
        accounts: local.accounts,
        activeId: local.activeId,
        users: {},
      });
    } catch (_e) {
      // brak blokady UI — traktujemy DB jako źródło docelowe, ale nie przerywamy pracy offline
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (!user) {
        setStore({ accounts: [], activeId: null });
        setReady(true);
        return;
      }

      try {
        const dbStore = await getAccessStoreFromDb();
        if (
          mounted &&
          dbStore &&
          Array.isArray(dbStore.accounts) &&
          dbStore.accounts.length > 0
        ) {
          writeAccessStoreSnapshot(dbStore);
        }
      } catch (_e) {
        // fallback lokalny
      }

      ensureDefaultAccessAccount();

      if (user.accessAccountId) {
        setActiveAccessAccount(user.accessAccountId);
      } else if (user.username) {
        const local = readAccessAccountsStore();
        const match = local.accounts.find((item) => item.username === user.username);
        if (match) {
          setActiveAccessAccount(match.id);
        }
      }

      refresh();
      setReady(true);
      syncCurrentStoreToDb();
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [user, refresh, syncCurrentStoreToDb]);

  const activeAccount = useMemo(
    () => store.accounts.find((item) => item.id === store.activeId) || null,
    [store]
  );

  const selectAccount = useCallback(
    (accessAccountId) => {
      const account = setActiveAccessAccount(accessAccountId);
      refresh();
      syncCurrentStoreToDb();
      logEvent({
        level: 'info',
        category: 'account',
        action: 'account.select',
        message: `Przełączono konto: ${account?.name || accessAccountId}`,
        details: { accessAccountId, username: account?.username },
      });
      return account;
    },
    [refresh, syncCurrentStoreToDb]
  );

  const createAccount = useCallback(
    ({ name, username, password }) => {
      const account = createAccessAccount({ name, username, password });
      refresh();
      syncCurrentStoreToDb();
      logEvent({
        level: 'info',
        category: 'account',
        action: 'account.create',
        message: `Utworzono konto: ${name}`,
        details: { accessAccountId: account.id, username, name },
      });
      return account;
    },
    [refresh, syncCurrentStoreToDb]
  );

  const updateAccount = useCallback(
    (accessAccountId, payload) => {
      const account = updateAccessAccount(accessAccountId, payload);
      refresh();
      syncCurrentStoreToDb();
      logEvent({
        level: 'info',
        category: 'account',
        action: 'account.update',
        message: `Zaktualizowano konto: ${account.name}`,
        details: {
          accessAccountId,
          username: account.username,
          name: account.name,
          passwordChanged: Boolean(payload.password),
        },
      });
      return account;
    },
    [refresh, syncCurrentStoreToDb]
  );

  const deleteAccount = useCallback(
    (accessAccountId) => {
      const before = readAccessAccountsStore().accounts.find((item) => item.id === accessAccountId);
      const result = deleteAccessAccount(accessAccountId);
      refresh();
      syncCurrentStoreToDb();
      logEvent({
        level: 'warn',
        category: 'account',
        action: 'account.delete',
        message: `Usunięto konto: ${before?.name || accessAccountId}`,
        details: {
          accessAccountId,
          username: before?.username,
          name: before?.name,
        },
      });
      return result;
    },
    [refresh, syncCurrentStoreToDb]
  );

  const value = useMemo(
    () => ({
      ready,
      accounts: store.accounts,
      activeAccount,
      activeAccountId: store.activeId,
      selectAccount,
      createAccount,
      updateAccount,
      deleteAccount,
      refresh,
    }),
    [ready, store, activeAccount, selectAccount, createAccount, updateAccount, deleteAccount, refresh]
  );

  return (
    <AccessAccountContext.Provider value={value}>{children}</AccessAccountContext.Provider>
  );
}

export function useAccessAccount() {
  const ctx = useContext(AccessAccountContext);
  if (!ctx) {
    throw new Error('useAccessAccount must be used within AccessAccountProvider');
  }
  return ctx;
}
