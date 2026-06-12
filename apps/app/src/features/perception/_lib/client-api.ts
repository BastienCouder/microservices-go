import { API_CONFIG } from "@/lib/api-config";
import {
  gatewayJSON,
  requireGatewayResult,
  unwrapGatewayPayload,
  type GatewayResult,
} from "@/shared/api/gateway";
import { readSelectedOrganizationPublicID } from "@/shared/selection";

function readData<T>(result: GatewayResult<unknown>): T {
  return unwrapGatewayPayload(
    requireGatewayResult(result, "Impossible de charger les donnees de perception."),
  ) as T;
}

function readOrganizationId(): string | undefined {
  const organizationId = readSelectedOrganizationPublicID();
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
