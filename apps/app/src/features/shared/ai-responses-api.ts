import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult } from "@/shared/api/gateway";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";

function resolveOrganizationContext(routeSearch: string): string | undefined {
  return (
    readOrganizationIdFromSearch(routeSearch) ||
    readSelectedOrganizationPublicID() ||
    undefined
  );
}

export async function deleteAIResponse(
  apiBaseURL: string,
  routeSearch: string,
  responseId: string,
) {
  const result = await gatewayJSON<{ deleted: boolean }>(
    apiBaseURL,
    apiRoutes.analysis.response(responseId),
    {
      method: "DELETE",
      organizationId: resolveOrganizationContext(routeSearch),
    },
  );

  return requireGatewayResult(result, "Impossible de supprimer la réponse.");
}
