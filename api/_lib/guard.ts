/**
 * SSRF guard for functions that fetch user-supplied URLs (the feed proxy):
 * http(s) only, no private / loopback / link-local targets (checked after DNS
 * resolution and again on every redirect hop).
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fetchTimeout, HttpError } from './http.js';
import { isBlockedHostname, isPrivateIp } from './ip.js';

export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, 'That is not a valid URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new HttpError(400, 'Only http and https addresses are allowed.');
  if (u.username || u.password) throw new HttpError(400, 'URLs with credentials are not allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new HttpError(400, 'Private network addresses are not allowed.');
    return u;
  }
  if (isBlockedHostname(host)) throw new HttpError(400, 'Private network addresses are not allowed.');
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new HttpError(400, `Couldn’t find the server “${host}”.`);
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new HttpError(400, 'Private network addresses are not allowed.');
  return u;
}

/** fetch() that re-validates every redirect target. */
export async function safeFetch(raw: string, init: RequestInit = {}, opts: { timeout?: number; maxRedirects?: number } = {}): Promise<{ res: Response; url: string }> {
  const deadline = Date.now() + (opts.timeout ?? 10_000);
  let url = (await assertPublicUrl(raw)).toString();
  for (let hop = 0; hop <= (opts.maxRedirects ?? 5); hop++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new HttpError(504, 'The remote server took too long to answer.');
    const res = await fetchTimeout(url, { ...init, redirect: 'manual' }, left);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      await res.body?.cancel().catch(() => undefined);
      url = (await assertPublicUrl(new URL(res.headers.get('location')!, url).toString())).toString();
      continue;
    }
    return { res, url };
  }
  throw new HttpError(508, 'Too many redirects.');
}
