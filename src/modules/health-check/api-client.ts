import { apiClient } from "@/lib/apiClient";
import { HealthCheckResponseType } from "./types";

/**
 * Fetches the health check status from the James server at `/healthcheck`.
 *
 * API: `GET http://ip:port/healthcheck`
 * Documentation: https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_healthcheck
 *
 * - Returns overall and per-component statuses (`healthy`, `degraded`, `unhealthy`).
 * - HTTP 200: All checks are `healthy` or `degraded`.
 * - HTTP 503: At least one check is `unhealthy`.
 */
export const getHealthCheck = async (): Promise<HealthCheckResponseType> => {
  const response = await apiClient.get<any, HealthCheckResponseType>(
    "/healthcheck"
  );
  return response; // Accessing the `data` property correctly
};
