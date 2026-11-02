import https from "node:https";
import dns from "node:dns";
import net from "node:net";

/** User-Agent that identifies the crawler. Set INGEST_USER_AGENT to include your contact URL. */
export const USER_AGENT = process.env.INGEST_USER_AGENT || "TrendPulseBot/0.1 (+competitor research; respects robots opt-outs on request)";

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::" || l === "::1") return true;
    if (/^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith("ff")) return true; // ULA, link-local, multicast
    if (l.startsWith("::ffff:")) {
      const v4 = l.slice(7);
      return net.isIPv4(v4) ? isPrivateIp(v4) : true; // hex-form mapped addresses: block conservatively
    }
    return false;
  }
  return true; // not an IP at all: treat as unsafe
}

/** Returns a clean public hostname, or null if the input is not an acceptable store domain. */
export function normalizeDomain(input: string): string | null {
  let h = input.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  h = h.replace(/\.$/, "");
  if (!h || h.length > 253 || h.includes("@") || h.includes(":") || net.isIP(h)) return null;
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) return null;
  if (/\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h)) return null;
  return h;
}

// Validates every resolved address at connect time, which also defeats DNS-rebinding.
function safeLookup(hostname: string, options: dns.LookupOptions, cb: (...a: unknown[]) => void) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return cb(new Error(`Blocked: ${hostname} resolves to a non-public address`));
    if (options?.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

export type FetchResult = { status: number; body: string };
export type Fetcher = (url: string) => Promise<FetchResult>;

/** SSRF-safe GET: https only, port 443, public IPs only, bounded redirects/size/time. */
export const fetchText: Fetcher = (rawUrl) => doFetch(rawUrl, 3);

function doFetch(rawUrl: string, redirects: number, maxBytes = 12_000_000, timeoutMs = 15_000): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try { u = new URL(rawUrl); } catch { return reject(new Error("Invalid URL")); }
    if (u.protocol !== "https:" || (u.port && u.port !== "443")) return reject(new Error("Only https on port 443 is allowed"));
    if (net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) return reject(new Error("IP-address hosts are not allowed"));
    const req = https.request(u, { method: "GET", timeout: timeoutMs, lookup: safeLookup as never,
      headers: { "user-agent": USER_AGENT, accept: "application/json" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error("Too many redirects"));
        return resolve(doFetch(new URL(res.headers.location, u).toString(), redirects - 1, maxBytes, timeoutMs));
      }
      const chunks: Buffer[] = []; let size = 0;
      res.on("data", (c: Buffer) => { size += c.length; if (size > maxBytes) req.destroy(new Error("Response too large")); else chunks.push(c); });
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}
