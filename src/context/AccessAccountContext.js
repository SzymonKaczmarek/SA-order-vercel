import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createAccessAccount,
  deleteAccessAccount,
  ensureDefaultAccessAccount,
  getAccessStoreSnapshot,
  readAccessAccountsStore,
  setActiveAccessAccount,
  updateAccessAccount,
  writeAccessStoreSnapshot,
} from '../data/accessAccounts';
import { getAccessStoreFromDb, setAccessStoreToDb } from '../hooks/useAppDbApi';
import { logEvent } from '../utils/eventLog';
import { useAuth } from './AuthContext';

const AccessAccountContext = createContext(null);

function formatSyncedAt(iso) {
  if (!iso) return 'Brak zapisu na serwerze';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch (_e) {
    return iso;
  }
}

export function AccessAccountProvider({ children }) {
  const { user } = useAuth();
  const [store, setStore] = useState({ accounts: [], activeId: null });
  const [ready, setReady] = useState(false);
  const [serverSyncing, setServerSyncing] = useState(false);
  const [serverSyncError, setServerSyncError] = useState('');
  const [serverSyncedAt, setServerSyncedAt] = useState(null);
  const [serverAccountCount, setServerAccountCount] = useState(0);

  const refresh = useCallback(() => {
    setStore(readAccessAccountsStore());
  }, []);

  const persistAccessStoreToServer = useCallback(async () => {
    const snapshot = getAccessStoreSnapshot();
    setServerSyncing(true);
    setServerSyncError('');

    try {
      const result = await setAccessStoreToDb(snapshot);
      const syncedAt = result?.syncedAt || snapshot.syncedAt || new Date().toISOString();
      setServerSyncedAt(syncedAt);
      setServerAccountCount(snapshot.accounts.length);
      return true;
    } catch (err) {
      const message = err?.message || 'Nie udało się zapisać kont na serwerze.';
      setServerSyncError(message);
      throw err;
    } finally {
      setServerSyncing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (!user) {
        setStore({ accounts: [], activeId: null });
        setServerSyncError('');
        setServerSyncedAt(null);
        setServerAccountCount(0);
        setReady(true);
        return;
      }

      setReady(false);
      setServerSyncError('');

      let serverStore = null;
      try {
        serverStore = await getAccessStoreFromDb();
        if (mounted && serverStore) {
          const remoteAccounts = Array.isArray(serverStore.accounts) ? serverStore.accounts : [];
          setServerAccountCount(remoteAccounts.length);
          if (serverStore.syncedAt) {
            setServerSyncedAt(serverStore.syncedAt);
          }

          if (remoteAccounts.length > 0) {
            writeAccessStoreSnapshot({
              accounts: serverStore.accounts,
              activeId: serverStore.activeId,
              users: serverStore.users,
            });
          }
        }
      } catch (err) {
        if (mounted) {
          setServerSyncError(err?.message || 'Nie udało się odczytać kont z serwera.');
        }
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

      if (mounted) {
        refresh();
      }

      try {
        await persistAccessStoreToServer();
      } catch (_e) {
        // błąd już w stanie UI
      }

      if (mounted) {
        setReady(true);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [user, refresh, persistAccessStoreToServer]);

  const activeAccount = useMemo(
    () => store.accounts.find((item) => item.id === store.activeId) || null,
    [store]
  );

  const selectAccount = useCallback(
    async (accessAccountId) => {
      const account = setActiveAccessAccount(accessAccountId);
      refresh();
      try {
        await persistAccessStoreToServer();
      } catch (_e) {
        // błąd w stanie UI
      }
      logEvent({
        level: 'info',
        category: 'account',
        action: 'account.select',
        message: `Przełączono konto: ${account?.name || accessAccountId}`,
        details: { accessAccountId, username: account?.username },
      });
      return account;
    },
    [refresh, persistAccessStoreToServer]
  );

  const createAccount = useCallback(
    async ({ name, username, password }) => {
      const account = createAccessAccount({ name, username, password });
      refresh();
      await persistAccessStoreToServer();
      logEvent({
        level: 'info',
        category: 'account',
        action: 'account.create',
        message: `Utworzono konto: ${name}`,
        details: { accessAccountId: account.id, username, name },
      });
      return account;
    },
    [refresh, persistAccessStoreToServer]
  );

  const updateAccount = useCallback(
    async (accessAccountId, payload) => {
      const account = updateAccessAccount(accessAccountId, payload);
      refresh();
      await persistAccessStoreToServer();
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
    [refresh, persistAccessStoreToServer]
  );

  const deleteAccount = useCallback(
    async (accessAccountId) => {
      const before = readAccessAccountsStore().accounts.find((item) => item.id === accessAccountId);
      const result = deleteAccessAccount(accessAccountId);
      refresh();
      await persistAccessStoreToServer();
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
    [refresh, persistAccessStoreToServer]
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
      serverSyncing,
      serverSyncError,
      serverSyncedAt,
      serverSyncedAtLabel: formatSyncedAt(serverSyncedAt),
      serverAccountCount,
      serverHasData: serverAccountCount > 0,
    }),
    [
      ready,
      store,
      activeAccount,
      selectAccount,
      createAccount,
      updateAccount,
      deleteAccount,
      refresh,
      serverSyncing,
      serverSyncError,
      serverSyncedAt,
      serverAccountCount,
    ]
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
