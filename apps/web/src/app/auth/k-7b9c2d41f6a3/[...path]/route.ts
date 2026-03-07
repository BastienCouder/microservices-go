import type { NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "user-agent",
] as const;

const DEFAULT_KRATOS_PROXY_URLS = ["http://kratos:4433", "http://microservices-go-prod-kratos-1:4433"];
const RETRY_DELAYS_MS = [150, 350, 750];

function getKratosProxyURLs(): string[] {
  const value = process.env.KRATOS_PUBLIC_PROXY_URL;
  const configured =
    typeof value === "string" && value.trim() !== ""
      ? value
          .split(",")
          .map((entry) => entry.trim().replace(/\/$/, ""))
          .filter(Boolean)
      : [];
  const merged = [...configured, ...DEFAULT_KRATOS_PROXY_URLS];
  return [...new Set(merged)];
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code?: string }).code ?? "");
    return code === "EAI_AGAIN" || code === "ECONNREFUSED" || code === "UND_ERR_CONNECT_TIMEOUT";
  }

  return false;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders(request: NextRequest, baseURL: string): Headers {
  const headers = new Headers();
  for (const key of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(key);
    if (value) {
      headers.set(key, value);
    }
  }
  headers.set("host", new URL(baseURL).host);
  headers.set("x-forwarded-host", request.headers.get("host") ?? request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  return headers;
}

async function resolveBaseURL(baseURL: string): Promise<string> {
  const url = new URL(baseURL);
  if (url.hostname === "localhost" || isIP(url.hostname) !== 0) {
    return url.toString().replace(/\/$/, "");
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const { address } = await lookup(url.hostname, { family: 4 });
      url.hostname = address;
      return url.toString().replace(/\/$/, "");
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  return url.toString().replace(/\/$/, "");
}

async function fetchFromKratos(
  request: NextRequest,
  targetURL: string,
  baseURL: string,
  body: ArrayBuffer | undefined,
): Promise<Response> {
  return fetch(targetURL, {
    method: request.method,
    headers: buildHeaders(request, baseURL),
    body,
    redirect: "manual",
  });
}

function buildFallbackRedirect(request: NextRequest): Response {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("error", "auth_proxy_unavailable");
  const returnTo = request.nextUrl.searchParams.get("return_to");
  if (returnTo) {
    url.searchParams.set("return_to", returnTo);
  }
  return Response.redirect(url, 307);
}

async function proxyToKratos(request: NextRequest, path: string[]): Promise<Response> {
  const pathname = path.join("/");
  const bases = getKratosProxyURLs();
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  let lastError: unknown;
  let response: Response | null = null;

  for (const baseURL of bases) {
    try {
      const resolvedBaseURL = await resolveBaseURL(baseURL);
      const targetURL = `${resolvedBaseURL}/${pathname}${request.nextUrl.search}`;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          response = await fetchFromKratos(request, targetURL, baseURL, body);
          break;
        } catch (error) {
          lastError = error;
          if (!isRetryableNetworkError(error) || attempt === RETRY_DELAYS_MS.length) {
            break;
          }
          await wait(RETRY_DELAYS_MS[attempt]);
        }
      }
      if (response) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    console.error("kratos proxy failed", {
      path: pathname,
      search: request.nextUrl.search,
      upstreams: bases,
      error:
        lastError instanceof Error
          ? {
              message: lastError.message,
              cause:
                lastError.cause && typeof lastError.cause === "object"
                  ? Object.fromEntries(Object.entries(lastError.cause))
                  : undefined,
            }
          : String(lastError),
    });
    return buildFallbackRedirect(request);
  }

  const nextHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      nextHeaders.append(key, value);
    }
  });

  return new Response(response.body, {
    status: response.status,
    headers: nextHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToKratos(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToKratos(request, path);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToKratos(request, path);
}
