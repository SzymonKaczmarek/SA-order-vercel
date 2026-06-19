import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addAccessAccountUser,
  createAccessAccount,
  ensureDefaultAccessAccount,
  getActiveAccessAccount,
  readAccessAccountUsers,
  readAccessAccountsStore,
  setActiveAccessAccount,
} from '../data/accessAccounts';
import { useAuth } from './AuthContext';

const AccessAccountContext = createContext(null);

export function AccessAccountProvider({ children }) {
  const { user } = useAuth();
  const [store, setStore] = useState({ accounts: [], activeId: null });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setStore(readAccessAccountsStore());
  }, []);

  useEffect(() => {
    if (!user) {
      setStore({ accounts: [], activeId: null });
      setReady(true);
      return;
    }

    ensureDefaultAccessAccount(user.email);
    refresh();
    setReady(true);
  }, [user, refresh]);

  const activeAccount = useMemo(
    () => store.accounts.find((item) => item.id === store.activeId) || null,
    [store]
  );

  const selectAccount = useCallback(
    (accessAccountId) => {
      const account = setActiveAccessAccount(accessAccountId);
      refresh();
      return account;
    },
    [refresh]
  );

  const createAccount = useCallback(
    ({ email, name }) => {
      const account = createAccessAccount({ email, name });
      refresh();
      return account;
    },
    [refresh]
  );

  const addUser = useCallback(
    (accessAccountId, userData) => {
      const entry = addAccessAccountUser(accessAccountId, userData);
      refresh();
      return entry;
    },
    [refresh]
  );

  const getUsers = useCallback((accessAccountId) => readAccessAccountUsers(accessAccountId), []);

  const value = useMemo(
    () => ({
      ready,
      accounts: store.accounts,
      activeAccount,
      activeAccountId: store.activeId,
      selectAccount,
      createAccount,
      addUser,
      getUsers,
      refresh,
    }),
    [ready, store, activeAccount, selectAccount, createAccount, addUser, getUsers, refresh]
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
