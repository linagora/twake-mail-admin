export enum HealthStatuses {
  HEALTHY = 'healthy',
  DEGRADED ='degraded',
  UNHEALTHY = 'unhealthy',
};

export type HealthCheckResult = {
  cause?: string;
  componentName: string;
  escapedComponentName: string;
  status: HealthStatuses.HEALTHY | HealthStatuses.DEGRADED | HealthStatuses.UNHEALTHY;
}
