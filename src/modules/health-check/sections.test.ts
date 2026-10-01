import { describe, expect, it } from "vitest";
import { groupHealthChecks } from "./sections";
import { HealthCheckType, HealthStatuses } from "./types";

const check = (componentName: string): HealthCheckType => ({
  componentName,
  escapedComponentName: encodeURIComponent(componentName),
  status: HealthStatuses.HEALTHY,
});

const namesBySection = (checks: HealthCheckType[], isCalendar: boolean) =>
  Object.fromEntries(
    groupHealthChecks(checks, isCalendar).map((section) => [
      section.key,
      section.checks.map((c) => c.componentName),
    ])
  );

describe("groupHealthChecks", () => {
  it("organises mail checks into sections", () => {
    const checks = [
      "Guice application lifecycle",
      "RabbitMQMailQueueDeadLetterQueueHealthCheck",
      "MailReceptionCheck",
      "Cassandra backend",
      "TMailEventBusConsumersHealthCheck",
      "EmptyErrorMailRepository",
      "Redis",
      "LDAP User Server",
    ].map(check);

    expect(namesBySection(checks, false)).toEqual({
      storage: ["Cassandra backend", "Redis", "LDAP User Server"],
      core: ["MailReceptionCheck", "EmptyErrorMailRepository"],
      rabbitmq: [
        "RabbitMQMailQueueDeadLetterQueueHealthCheck",
        "TMailEventBusConsumersHealthCheck",
      ],
      other: ["Guice application lifecycle"],
    });
  });

  it("keeps sections in a stable order", () => {
    const checks = ["Unknown", "IMAPHealthCheck", "OpenSearch Backend"].map(check);

    expect(groupHealthChecks(checks, false).map((s) => s.key)).toEqual([
      "storage",
      "core",
      "other",
    ]);
  });

  it("organises calendar checks into storage and other", () => {
    const checks = ["MongoDB", "MailReceptionCheck", "RabbitMQ backend"].map(check);

    expect(namesBySection(checks, true)).toEqual({
      storage: ["MongoDB", "RabbitMQ backend"],
      other: ["MailReceptionCheck"],
    });
  });

  it("returns no section when there is no check", () => {
    expect(groupHealthChecks([], false)).toEqual([]);
  });
});
