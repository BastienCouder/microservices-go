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

type PerceptionClientOptions = {
  organizationId?: string;
};

function readOrganizationId(override?: string): string | undefined {
  const organizationId = override?.trim() || readSelectedOrganizationPublicID();
  return organizationId || undefined;
}

export async function getPerceptionClientJSON<T>(
  path: string,
  options?: PerceptionClientOptions,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "GET",
    organizationId: readOrganizationId(options?.organizationId),
  });

  return readData<T>(result);
}

export async function postPerceptionClientJSON<T>(
  path: string,
  body: unknown,
  options?: PerceptionClientOptions,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "POST",
    body: JSON.stringify(body),
    organizationId: readOrganizationId(options?.organizationId),
  });

  return readData<T>(result);
}

export async function patchPerceptionClientJSON<T>(
  path: string,
  body: unknown,
  options?: PerceptionClientOptions,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "PATCH",
    body: JSON.stringify(body),
    organizationId: readOrganizationId(options?.organizationId),
  });

  return readData<T>(result);
}

export async function deletePerceptionClientJSON<T>(
  path: string,
  options?: PerceptionClientOptions,
): Promise<T> {
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    method: "DELETE",
    organizationId: readOrganizationId(options?.organizationId),
  });

  return readData<T>(result);
}
