/**
 * Minimal next/headers shim for Neon Auth SDK compatibility.
 *
 * The Neon Auth SDK (@neondatabase/auth/next) imports cookies/headers from "next/headers".
 * authApiHandler() doesn't use them (it's framework-agnostic), but the import must resolve.
 *
 * This shim provides no-op implementations since authApiHandler uses standard Request/Response.
 */

let _currentRequest = null;

export function setRequestForHeaders(request) {
  _currentRequest = request;
}

export function clearRequestForHeaders() {
  _currentRequest = null;
}

function parseCookies(cookieHeader) {
  const map = new Map();
  if (!cookieHeader) return map;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    map.set(name, decodeURIComponent(value));
  }
  return map;
}

export async function cookies() {
  const cookieHeader = _currentRequest?.headers?.get('cookie') || '';
  const parsed = parseCookies(cookieHeader);

  return {
    get(name) {
      const value = parsed.get(name);
      return value !== undefined ? { name, value } : undefined;
    },
    getAll(name) {
      if (name) {
        const value = parsed.get(name);
        return value !== undefined ? [{ name, value }] : [];
      }
      return Array.from(parsed.entries()).map(([n, v]) => ({ name: n, value: v }));
    },
    has(name) {
      return parsed.has(name);
    },
    set(name, value) {
      parsed.set(name, value);
    },
    delete(name) {
      parsed.delete(name);
    },
    toString() {
      return Array.from(parsed.entries()).map(([n, v]) => `${n}=${v}`).join('; ');
    },
  };
}

export async function headers() {
  const h = _currentRequest?.headers;
  return {
    get(name) {
      return h?.get(name) ?? null;
    },
    has(name) {
      return h?.has(name) ?? false;
    },
    entries() {
      return h?.entries() ?? new Headers().entries();
    },
    keys() {
      return h?.keys() ?? new Headers().keys();
    },
    values() {
      return h?.values() ?? new Headers().values();
    },
  };
}
