import { HealthCheckType } from "./types";

export type HealthCheckSectionKey =
  | "storage"
  | "core"
  | "rabbitmq"
  | "other";

type SectionDefinition = {
  key: HealthCheckSectionKey;
  matches: (componentName: string) => boolean;
};

export type HealthCheckSection = {
  key: HealthCheckSectionKey;
  checks: HealthCheckType[];
};

const oneOf =
  (...names: string[]) =>
  (componentName: string) =>
    names.includes(componentName);

const MAIL_SECTIONS: SectionDefinition[] = [
  {
    key: "storage",
    matches: oneOf(
      "LDAP User Server",
      "Cassandra backend",
      "OpenSearch Backend",
      "RabbitMQ backend",
      "Redis"
    ),
  },
  {
    key: "core",
    matches: oneOf(
      "MailReceptionCheck",
      "IMAPHealthCheck",
      "EventDeadLettersHealthCheck",
      "EmptyErrorMailRepository"
    ),
  },
  {
    key: "rabbitmq",
    matches: (componentName) =>
      componentName.endsWith("DeadLetterQueueHealthCheck") ||
      componentName.includes("Consumers"),
  },
];

const CALENDAR_SECTIONS: SectionDefinition[] = [
  {
    key: "storage",
    matches: oneOf(
      "MongoDB",
      "Redis",
      "OpenSearch Backend",
      "RabbitMQ backend",
      "LDAP User Server"
    ),
  },
];

const CATCH_ALL: SectionDefinition = { key: "other", matches: () => true };

const sectionOf = (
  definitions: SectionDefinition[],
  check: HealthCheckType
): HealthCheckSectionKey =>
  (definitions.find((definition) => definition.matches(check.componentName)) ?? CATCH_ALL).key;

/**
 * Groups health checks into ordered sections, dropping empty ones.
 * Unknown components fall into the "other" catch-all section.
 */
export const groupHealthChecks = (
  checks: HealthCheckType[],
  isCalendar: boolean
): HealthCheckSection[] => {
  const definitions = isCalendar ? CALENDAR_SECTIONS : MAIL_SECTIONS;
  return [...definitions, CATCH_ALL]
    .map(({ key }) => ({
      key,
      checks: checks.filter((check) => sectionOf(definitions, check) === key),
    }))
    .filter((section) => section.checks.length > 0);
};
