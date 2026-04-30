const inFlightGA4OAuthCallbackStates = new Set<string>();

function normalizeGA4OAuthCallbackState(state: string): string {
  return state.trim();
}

export function claimGA4OAuthCallbackState(state: string): boolean {
  const normalized = normalizeGA4OAuthCallbackState(state);
  if (!normalized || inFlightGA4OAuthCallbackStates.has(normalized)) {
    return false;
  }
  inFlightGA4OAuthCallbackStates.add(normalized);
  return true;
}

export function releaseGA4OAuthCallbackState(state: string) {
  const normalized = normalizeGA4OAuthCallbackState(state);
  if (normalized) {
    inFlightGA4OAuthCallbackStates.delete(normalized);
  }
}

export function clearGA4OAuthCallbackStateClaims() {
  inFlightGA4OAuthCallbackStates.clear();
}
