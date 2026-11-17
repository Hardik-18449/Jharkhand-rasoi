/**
 * Storage layer replacing localStorage/sessionStorage.
 * - Backed by AsyncStorage, with an in-memory mirror so reads are synchronous (web code reads localStorage sync).
 * - `hydrateStorage()` must run once at app start (root layout) before screens render.
 * - sessionStorage equivalents are memory-only (cleared on app restart) — same lifetime semantics as a browser tab.
 * Namespaced helpers mirror web `utils/appStorage.js` exactly (`food:v1:<scope>:<name>`).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_NAMESPACE = "food:v1";
const DEFAULT_META_VERSION = 1;

const memLocal = new Map();
const memSession = new Map();
let hydrated = false;

export async function hydrateStorage() {
  if (hydrated) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length) {
      const pairs = await AsyncStorage.multiGet(keys);
      pairs.forEach(([k, v]) => {
        if (v != null) memLocal.set(k, v);
      });
    }
  } catch {
    // start empty
  }
  hydrated = true;
}

export function isStorageHydrated() {
  return hydrated;
}

const persistSet = (key, value) => {
  AsyncStorage.setItem(key, value).catch(() => {});
};
const persistRemove = (key) => {
  AsyncStorage.removeItem(key).catch(() => {});
};

/** localStorage-like sync API */
export const localStore = {
  getItem: (key) => (memLocal.has(key) ? memLocal.get(key) : null),
  setItem: (key, value) => {
    const v = String(value);
    memLocal.set(key, v);
    persistSet(key, v);
  },
  removeItem: (key) => {
    memLocal.delete(key);
    persistRemove(key);
  },
  keys: () => [...memLocal.keys()],
};

/** sessionStorage-like (memory only) */
export const sessionStore = {
  getItem: (key) => (memSession.has(key) ? memSession.get(key) : null),
  setItem: (key, value) => memSession.set(key, String(value)),
  removeItem: (key) => memSession.delete(key),
};

function getStorage(type = "local") {
  return type === "session" ? sessionStore : localStore;
}

export function createStorageKey(scope, name) {
  return [STORAGE_NAMESPACE, scope, name].filter(Boolean).join(":");
}

export function readRawStorage(key, { storage = "local" } = {}) {
  return getStorage(storage).getItem(key);
}

export function writeRawStorage(key, value, { storage = "local" } = {}) {
  getStorage(storage).setItem(key, value);
  return true;
}

export function removeStorageKey(key, { storage = "local" } = {}) {
  getStorage(storage).removeItem(key);
  return true;
}

export function readJSONStorage(key, { storage = "local", fallback = null } = {}) {
  const raw = readRawStorage(key, { storage });
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSONStorage(key, value, { storage = "local" } = {}) {
  return writeRawStorage(key, JSON.stringify(value), { storage });
}

export function writeScopedValue(scope, name, value, options = {}) {
  return writeJSONStorage(createStorageKey(scope, name), value, options);
}

export function readScopedValue(scope, name, options = {}) {
  return readJSONStorage(createStorageKey(scope, name), options);
}

export function removeScopedValue(scope, name, options = {}) {
  return removeStorageKey(createStorageKey(scope, name), options);
}

export function writeScopedCachedValue(scope, name, value, { storage = "local", ttlMs = null, version = DEFAULT_META_VERSION } = {}) {
  return writeScopedValue(
    scope,
    name,
    {
      value,
      meta: {
        version,
        savedAt: Date.now(),
        expiresAt: Number.isFinite(ttlMs) ? Date.now() + ttlMs : null,
      },
    },
    { storage },
  );
}

export function readScopedCachedValue(scope, name, { storage = "local", fallback = null, minVersion = DEFAULT_META_VERSION } = {}) {
  const key = createStorageKey(scope, name);
  const payload = readJSONStorage(key, { storage });
  if (!payload || typeof payload !== "object" || !("meta" in payload)) return fallback;
  const version = Number(payload?.meta?.version ?? DEFAULT_META_VERSION);
  if (version < minVersion) {
    removeStorageKey(key, { storage });
    return fallback;
  }
  const expiresAt = Number(payload?.meta?.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
    removeStorageKey(key, { storage });
    return fallback;
  }
  return payload?.value ?? fallback;
}

export function cleanupExpiredScopedEntries({ storage = "local", prefix = STORAGE_NAMESPACE } = {}) {
  const target = getStorage(storage);
  const keys = storage === "session" ? [...memSession.keys()] : target.keys();
  let removed = 0;
  keys.forEach((key) => {
    if (!key || !key.startsWith(prefix)) return;
    const payload = readJSONStorage(key, { storage });
    const expiresAt = Number(payload?.meta?.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now()) {
      target.removeItem(key);
      removed += 1;
    }
  });
  return removed;
}

/** Convenience JSON helpers for plain (non-scoped) keys, used by ported contexts (cart, profile, orders…). */
export const getJSON = (key, fallback = null) => readJSONStorage(key, { fallback });
export const setJSON = (key, value) => writeJSONStorage(key, value);
