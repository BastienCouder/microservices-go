import { API_CONFIG, buildApiPath } from "@/lib/api-config";

function buildURL(path: string): string {
  const base = API_CONFIG.BASE_URL?.trim();
  return base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
}

async function readJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string };
  if (json?.data !== undefined) return json.data;
  throw new Error(json?.message || "Reponse API invalide");
}

export async function getPerceptionClientJSON<T>(path: string): Promise<T> {
  const res = await fetch(buildURL(path), {
    method: "GET",
    credentials: "include",
  });

  return readJSON<T>(res);
}

export async function postPerceptionClientJSON<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(buildURL(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJSON<T>(res);
}
