import { API_CONFIG } from "@/lib/api-config";
import { gatewayJSON, type GatewayResult } from "@/shared/api/gateway";
import { readSelectedOrganizationID } from "@/shared/selection";

function readData<T>(result: GatewayResult<unknown>): T {
  if (!result.ok) throw new Error(result.error || `HTTP ${result.status}`);

  const json = result.data as { data?: T; message?: string };
  if (json?.data !== undefined) return json.data;
  throw new Error(json?.message || "Reponse API invalide");
}

function readOrganizationId(): string | undefined {
  const organizationId = readSelectedOrganizationID();
  return organizationId || undefined;
}

export async function getPerceptionClientJSON<T>(path: string): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "GET",
    organizationId: readOrganizationId(),
  });

  return readData<T>(result);
}

export async function postPerceptionClientJSON<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "POST",
    body: JSON.stringify(body),
    organizationId: readOrganizationId(),
  });

  return readData<T>(result);
}

export async function patchPerceptionClientJSON<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "PATCH",
    body: JSON.stringify(body),
    organizationId: readOrganizationId(),
  });

  return readData<T>(result);
}

export async function deletePerceptionClientJSON<T>(path: string): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "DELETE",
    organizationId: readOrganizationId(),
  });

  return readData<T>(result);
}
