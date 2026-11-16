// What WebAdmin answers for a route it does not have, e.g. "GET /domains/d/team-mailboxes/m/space can not be found".
// A 404 with any other message (an unknown user or domain) is an error, not a missing feature.
const MISSING_ROUTE_MESSAGE = /^[A-Z]+ \S+ can not be found$/;

interface WebAdminError {
  response?: { status?: number; data?: { message?: string } };
}

export const isMissingRoute = (err: unknown): boolean => {
  const response = (err as WebAdminError | null)?.response;
  return response?.status === 404 && MISSING_ROUTE_MESSAGE.test(response.data?.message ?? "");
};
