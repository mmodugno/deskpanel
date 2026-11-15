import { randomBytes, timingSafeEqual } from 'node:crypto';

export function createToken() {
  return randomBytes(16).toString('hex');
}

export function tokenMatches(expected, given) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function extractToken(req, url) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return url.searchParams.get('token');
}
