import { useCallback, useEffect, useState } from 'react';
import { useAccessAccount } from '../context/AccessAccountContext';
import { getSellasistConfigFromDb, setSellasistConfigToDb } from './useAppDbApi';
import { logEvent } from '../utils/eventLog';

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

/** Scala lokalną konfigurację z wpisem z bazy — nie nadpisuje apiKey pustym remote. */
export function mergeSellasistConfig(local, remote) {
  const base = { ...DEFAULT_CONFIG, ...(local || {}) };
  if (!remote || typeof remote !== 'object') {
    return base;
  }

  const remoteAccount = String(remote.account || '').trim();
  const localAccount = String(base.account || '').trim();
  const remoteKey = String(remote.apiKey || '').trim();
  const localKey = String(base.apiKey || '').trim();

  return {
    account: remoteAccount || localAccount,
    apiKey: remoteKey || localKey,
    useDemoData:
      remote.useDemoData != null ? Boolean(remote.useDemoData) : Boolean(base.useDemoData),
  };
}

export async function resolveSellasistConfigForAccount(accessAccountId) {
  const local = readSellasistConfig(accessAccountId);
  if (!accessAccountId) {
    return local;
  }

  try {
    const remote = await getSellasistConfigFromDb(accessAccountId);
    const merged = mergeSellasistConfig(local, remote);
    writeSellasistConfig(accessAccountId, merged);
    return merged;
  } catch (_e) {
    return local;
  }
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
  const [configSynced, setConfigSynced] = useState(false);

  useEffect(() => {
    if (!accountReady || !activeAccountId) {
      setLoaded(false);
      setConfigSynced(false);
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      setLoaded(false);
      setConfigSynced(false);

      const localConfig = readSellasistConfig(activeAccountId);
      if (mounted) {
        setConfigState(localConfig);
      }

      try {
        const merged = await resolveSellasistConfigForAccount(activeAccountId);
        if (mounted) {
          setConfigState(merged);
        }
      } catch (_e) {
        if (mounted) {
          setConfigState(localConfig);
        }
      }

      if (mounted) {
        setLoaded(true);
        setConfigSynced(true);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [accountReady, activeAccountId]);

  const setConfig = useCallback(
    (next) => {
      if (!activeAccountId) return;
      writeSellasistConfig(activeAccountId, next);
      setConfigState(readSellasistConfig(activeAccountId));
      setSellasistConfigToDb(activeAccountId, {
        account: (next.account || '').trim(),
        apiKey: (next.apiKey || '').trim(),
        useDemoData: Boolean(next.useDemoData),
      }).catch((err) => {
        logEvent({
          level: 'error',
          category: 'config',
          action: 'config.save.error',
          message: 'Błąd zapisu konfiguracji na serwerze',
          details: { accessAccountId: activeAccountId, error: err?.message },
        });
      });
      logEvent({
        level: 'info',
        category: 'config',
        action: 'config.save',
        message: 'Zapisano konfigurację Sellasist',
        details: {
          accessAccountId: activeAccountId,
          account: (next.account || '').trim(),
          useDemoData: Boolean(next.useDemoData),
          apiKey: next.apiKey ? '[ukryte]' : '',
        },
      });
    },
    [activeAccountId]
  );

  const refreshConfigFromDb = useCallback(async () => {
    if (!activeAccountId) {
      return DEFAULT_CONFIG;
    }

    const merged = await resolveSellasistConfigForAccount(activeAccountId);
    setConfigState(merged);
    setConfigSynced(true);
    return merged;
  }, [activeAccountId]);

  return {
    config,
    loaded,
    configSynced,
    setConfig,
    refreshConfigFromDb,
    activeAccountId,
    isConfigured: isSellasistConfigured(config),
    isDemoMode: isDemoMode(config),
  };
}
