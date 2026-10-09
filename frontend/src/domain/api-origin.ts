const configuredApiOrigin = process.env.EXPO_PUBLIC_GYMBRO_API_URL ?? '';

export function apiURL(path: string, base = configuredApiOrigin): string {
  if (!path.startsWith('/')) throw new Error('API path must be absolute within its origin');
  if (!base) return path;
  const origin = new URL(base);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
    throw new Error('API origin must use HTTPS outside local development');
  }
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) throw new Error('API path escaped its configured origin');
  return url.href;
}

export function apiFetch(path: string, init: RequestInit = {}, base = configuredApiOrigin): Promise<Response> {
  return fetch(apiURL(path, base), { ...init, credentials: 'include' });
}
