import { useCallback, useEffect, useState } from 'react';
import { useAccessAccount } from '../context/AccessAccountContext';

const CONFIG_KEY = 'saor_sellasist_config';

const DEFAULT_CONFIG = {
  account: '',
  apiKey: '',
  useDemoData: false,
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

function isLegacyFlatConfig(store) {
  if (!store || typeof store !== 'object') return false;
  const keys = Object.keys(store);
  if (keys.some((key) => key.startsWith('acc_'))) return false;
  return keys.length > 0 && ('account' in store || 'apiKey' in store || 'useDemoData' in store);
}

function readConfigStore() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(CONFIG_KEY), {});
}

function writeConfigStore(store) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(store));
}

export function migrateLegacySellasistConfig(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) return;

  const store = readConfigStore();
  if (store[accessAccountId]) return;

  if (!isLegacyFlatConfig(store)) return;

  writeConfigStore({
    [accessAccountId]: {
      account: store.account || '',
      apiKey: store.apiKey || '',
      useDemoData: Boolean(store.useDemoData),
    },
  });
}

export function readSellasistConfig(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) return { ...DEFAULT_CONFIG };

  migrateLegacySellasistConfig(accessAccountId);
  const store = readConfigStore();
  return { ...DEFAULT_CONFIG, ...(store[accessAccountId] || {}) };
}

export function writeSellasistConfig(accessAccountId, config) {
  if (typeof window === 'undefined' || !accessAccountId) return;

  const payload = {
    account: (config.account || '').trim(),
    apiKey: (config.apiKey || '').trim(),
    useDemoData: Boolean(config.useDemoData),
  };

  const store = readConfigStore();
  store[accessAccountId] = payload;
  writeConfigStore(store);
}

export function isDemoMode(config) {
  return Boolean(config?.useDemoData);
}

export function isSellasistConfigured(config) {
  if (isDemoMode(config)) return true;
  return Boolean(config.account && config.apiKey);
}

export function useSellasistConfig() {
  const { activeAccountId, ready: accountReady } = useAccessAccount();
  const [config, setConfigState] = useState(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!accountReady || !activeAccountId) {
      setLoaded(false);
      return;
    }

    setConfigState(readSellasistConfig(activeAccountId));
    setLoaded(true);
  }, [accountReady, activeAccountId]);

  const setConfig = useCallback(
    (next) => {
      if (!activeAccountId) return;
      writeSellasistConfig(activeAccountId, next);
      setConfigState(readSellasistConfig(activeAccountId));
    },
    [activeAccountId]
  );

  return {
    config,
    loaded,
    setConfig,
    activeAccountId,
    isConfigured: isSellasistConfigured(config),
    isDemoMode: isDemoMode(config),
  };
}
