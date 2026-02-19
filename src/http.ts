import https from "node:https";
import { URL } from "node:url";

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  bodyText: string;
}

export async function httpsRequest(opts: {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<HttpResponse> {
  const u = new URL(opts.url);

  return await new Promise<HttpResponse>((resolve, reject) => {
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: opts.method,
        headers: opts.headers,
        timeout: opts.timeoutMs ?? 30000,
        // Force HTTP/1.1 to avoid ALPN/TLS fingerprint differences.
        ALPNProtocols: ["http/1.1"],
      } as any,
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            bodyText,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error(`request timeout after ${opts.timeoutMs ?? 30000}ms`));
    });

    req.on("error", (err) => reject(err));

    if (opts.body) req.write(opts.body);
    req.end();
  });
}
