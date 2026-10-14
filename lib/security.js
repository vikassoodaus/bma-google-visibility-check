import dns from 'node:dns/promises';
import net from 'node:net';

const PRIVATE_V4 = [
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['0.0.0.0', 8],
  ['100.64.0.0', 10],
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, part) => ((acc << 8) + Number(part)) >>> 0, 0) >>> 0;
}

function inCidr(ip, base, bits) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    return PRIVATE_V4.some(([base, bits]) => inCidr(ip, base, bits));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:') || lower === '::';
  }
  return true;
}

export function normaliseUrl(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Enter a website URL.');
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS websites can be checked.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Only standard web ports are allowed.');
  url.hash = '';
  return url;
}

export async function assertPublicUrl(url) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) throw new Error('Private or local addresses are not allowed.');
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Private network addresses are not allowed.');
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('The domain could not be resolved.');
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error('The website resolves to a private network address.');
  }
}
