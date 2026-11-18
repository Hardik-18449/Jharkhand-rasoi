/**
 * Replaces `window.dispatchEvent(new CustomEvent(name, { detail }))` / `window.addEventListener`.
 * Same event names as the web app so ported logic is unchanged.
 */
const listeners = new Map();

export function addAppListener(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => removeAppListener(name, fn);
}

export function removeAppListener(name, fn) {
  listeners.get(name)?.delete(fn);
}

export function dispatchAppEvent(name, detail) {
  const set = listeners.get(name);
  if (!set) return;
  const event = { type: name, detail };
  [...set].forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore listener errors
    }
  });
}
