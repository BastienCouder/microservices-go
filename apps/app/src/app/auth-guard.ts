import type { UserProfile } from "@/shared/models";

type ShouldRedirectUnauthenticatedInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
};

export function shouldRedirectUnauthenticated({
  apiBaseURL,
  busy,
  user,
}: ShouldRedirectUnauthenticatedInput): boolean {
  if (apiBaseURL.trim() === "") {
    return false;
  }
  if (busy) {
    return false;
  }
  return user === null;
}
