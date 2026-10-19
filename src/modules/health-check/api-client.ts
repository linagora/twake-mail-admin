import { apiClient } from "@/lib/apiClient";
import { HealthCheckResponseType } from "./types";

/**
 * Fetches the health check status from the James server at `/healthcheck`.
 *
 * API: `GET http://ip:port/healthcheck`
 * Documentation: https://james.staged.apache.org/james-project/3.10.0/servers/distributed/operate/webadmin.html#_healthcheck
 *
 * - Returns overall and per-component statuses (`healthy`, `degraded`, `unhealthy`).
 * - HTTP 200: All checks are `healthy` or `degraded`.
 * - HTTP 503: At least one check is `unhealthy`.
 */
export const getHealthCheck = async (): Promise<HealthCheckResponseType> => {
  // A 503 is WebAdmin's normal "something is unhealthy" answer and carries the usual body
  return apiClient.get<any, HealthCheckResponseType>("/healthcheck", {
    validateStatus: (status) => status === 200 || status === 503,
  });
};
