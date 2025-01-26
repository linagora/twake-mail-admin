export enum HealthStatuses {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

export type HealthCheckType = {
  cause?: string;
  componentName: string;
  escapedComponentName: string;
  status:
    | HealthStatuses.HEALTHY
    | HealthStatuses.DEGRADED
    | HealthStatuses.UNHEALTHY;
};

export type HealthCheckResponseType = {
  status: string; // or use an enum if the status has specific values
  checks: HealthCheckType[];
};
