import { useCallback, useEffect, useState } from 'react';
import { useAccessAccount } from '../context/AccessAccountContext';
import { getSellasistConfigFromDb, setSellasistConfigToDb } from './useAppDbApi';
import { logEvent } from '../utils/eventLog';

const LEGACY_CONFIG_KEY = 'saor_sellasist_config';

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

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  return {
    account: String(raw.account || '').trim(),
    apiKey: String(raw.apiKey || '').trim(),
    useDemoData: Boolean(raw.useDemoData),
  };
}

function isLegacyFlatConfig(store) {
  if (!store || typeof store !== 'object') return false;
  const keys = Object.keys(store);
  if (keys.some((key) => key.startsWith('acc_'))) return false;
  return keys.length > 0 && ('account' in store || 'apiKey' in store || 'useDemoData' in store);
}

function readLegacyConfigStore() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(LEGACY_CONFIG_KEY), {});
}

function writeLegacyConfigStore(store) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(store));
}

function readLegacyLocalConfig(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) {
    return { ...DEFAULT_CONFIG };
  }

  const store = readLegacyConfigStore();

  if (store[accessAccountId]) {
    return normalizeConfig(store[accessAccountId]);
  }

  if (!isLegacyFlatConfig(store)) {
    return { ...DEFAULT_CONFIG };
  }

  return normalizeConfig(store);
}

function clearLegacyLocalConfig(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) {
    return;
  }

  const store = readLegacyConfigStore();
  if (store[accessAccountId]) {
    delete store[accessAccountId];
    writeLegacyConfigStore(store);
    return;
  }

  if (!isLegacyFlatConfig(store)) {
    return;
  }

  writeLegacyConfigStore({});
}

async function fetchConfigFromDb(accessAccountId) {
  const remote = await getSellasistConfigFromDb(accessAccountId);
  if (!remote) {
    return { ...DEFAULT_CONFIG };
  }
  return normalizeConfig(remote);
}

async function migrateLegacyLocalToDb(accessAccountId) {
  const local = readLegacyLocalConfig(accessAccountId);
  const hasLocal =
    Boolean(local.account) || Boolean(local.apiKey) || Boolean(local.useDemoData);

  if (!hasLocal) {
    return;
  }

  let remote = { ...DEFAULT_CONFIG };
  try {
    remote = await fetchConfigFromDb(accessAccountId);
  } catch (_e) {
    remote = { ...DEFAULT_CONFIG };
  }

  const remoteEmpty = !remote.account && !remote.apiKey && !remote.useDemoData;
  if (remoteEmpty) {
    await setSellasistConfigToDb(accessAccountId, local);
    clearLegacyLocalConfig(accessAccountId);
    return;
  }

  if (local.apiKey && !remote.apiKey) {
    await setSellasistConfigToDb(accessAccountId, {
      ...remote,
      apiKey: local.apiKey,
      account: remote.account || local.account,
      useDemoData: remote.useDemoData || local.useDemoData,
    });
  }

  clearLegacyLocalConfig(accessAccountId);
}

export async function resolveSellasistConfigForAccount(accessAccountId) {
  if (!accessAccountId) {
    return { ...DEFAULT_CONFIG };
  }

  await migrateLegacyLocalToDb(accessAccountId);
  return fetchConfigFromDb(accessAccountId);
}

/** @deprecated Konfiguracja jest trzymana wyłącznie w bazie danych. */
export function readSellasistConfig(_accessAccountId) {
  return { ...DEFAULT_CONFIG };
}

/** @deprecated Użyj setConfig z hooka useSellasistConfig. */
export function writeSellasistConfig(accessAccountId, _config) {
  clearLegacyLocalConfig(accessAccountId);
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
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!accountReady || !activeAccountId) {
      setConfigState(DEFAULT_CONFIG);
      setLoaded(false);
      setConfigSynced(false);
      setLoadError('');
      return;
    }

    let mounted = true;

    const bootstrap = async () => {
      setLoaded(false);
      setConfigSynced(false);
      setLoadError('');

      try {
        const remote = await resolveSellasistConfigForAccount(activeAccountId);
        if (mounted) {
          setConfigState(remote);
          setConfigSynced(true);
        }
      } catch (err) {
        if (mounted) {
          setConfigState(DEFAULT_CONFIG);
          setLoadError(err?.message || 'Nie udało się wczytać konfiguracji z bazy danych.');
        }
      } finally {
        if (mounted) {
          setLoaded(true);
        }
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [accountReady, activeAccountId]);

  const setConfig = useCallback(
    async (next) => {
      if (!activeAccountId) {
        throw new Error('Brak aktywnego konta dostępu.');
      }

      const payload = normalizeConfig(next);

      try {
        await setSellasistConfigToDb(activeAccountId, payload);
        setConfigState(payload);
        clearLegacyLocalConfig(activeAccountId);
        setConfigSynced(true);
        setLoadError('');

        logEvent({
          level: 'info',
          category: 'config',
          action: 'config.save',
          message: 'Zapisano konfigurację Sellasist w bazie danych',
          details: {
            accessAccountId: activeAccountId,
            account: payload.account,
            useDemoData: payload.useDemoData,
            apiKey: payload.apiKey ? '[ukryte]' : '',
            storage: 'server_db',
          },
        });

        return payload;
      } catch (err) {
        logEvent({
          level: 'error',
          category: 'config',
          action: 'config.save.error',
          message: 'Błąd zapisu konfiguracji w bazie danych',
          details: { accessAccountId: activeAccountId, error: err?.message },
        });
        throw err;
      }
    },
    [activeAccountId]
  );

  const refreshConfigFromDb = useCallback(async () => {
    if (!activeAccountId) {
      return DEFAULT_CONFIG;
    }

    const remote = await resolveSellasistConfigForAccount(activeAccountId);
    setConfigState(remote);
    setConfigSynced(true);
    setLoadError('');
    return remote;
  }, [activeAccountId]);

  return {
    config,
    loaded,
    configSynced,
    loadError,
    setConfig,
    refreshConfigFromDb,
    activeAccountId,
    isConfigured: isSellasistConfigured(config),
    isDemoMode: isDemoMode(config),
  };
}
