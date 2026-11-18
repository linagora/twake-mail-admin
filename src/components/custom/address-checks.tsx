import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useCheckUserExists, UserExistsStatus } from "@/hooks/use-check-user-exists";

/**
 * The source of an alias, of an address mapping or of a regex mapping, checked against the accounts:
 * mail to an existing account would be diverted or rewritten (WebAdmin does not refuse it, linagora/james-project#5620),
 * so such a source, or one still being checked or invalid, blocks the creation.
 */
export function useSourceCheck(source: string): { status: UserExistsStatus; blocking: boolean } {
  const status = useCheckUserExists(source, { checkSyntax: false });
  return { status, blocking: status === "checking" || status === "exists" || status === "invalid" };
}

/**
 * How the mail of an existing account would be affected: an alias or an address mapping diverts it
 * to its destination, a regex mapping rewrites it (its destination is a pattern, not an address).
 */
export type SourceEffect = "diverted" | "rewritten";

function sourceIsAccountMessage(t: TFunction, source: string, destination: string, effect: SourceEffect): string {
  if (effect === "rewritten") {
    return t("common.sourceIsAccountRegex", { source });
  }
  return destination
    ? t("common.sourceIsAccount", { source, destination })
    : t("common.sourceIsAccountNoDestination", { source });
}

/** The line under a source field: an existing account is a red warning telling what would happen to its mail. */
export function SourceLine({ source, destination, status, effect = "diverted" }: {
  source: string;
  destination: string;
  status: UserExistsStatus;
  effect?: SourceEffect;
}) {
  const { t } = useTranslation();
  return (
    // Reserved height: the status appearing does not resize the modal
    <p className="min-h-4 mt-1 text-xs">
      {status === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
      {status === "exists" && (
        <span role="alert" className="text-red-600">
          {sourceIsAccountMessage(t, source.trim(), destination.trim(), effect)}
        </span>
      )}
      {status === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
    </p>
  );
}

/** The line under the destination of an address mapping: informational, it never blocks. */
export function DestinationLine({ destination }: { destination: string }) {
  const { t } = useTranslation();
  const status = useCheckUserExists(destination);
  return (
    <p className="min-h-4 mt-1 text-xs">
      {status === "checking" && <span className="text-gray-400">{t("common.checking")}</span>}
      {status === "exists" && <span className="text-green-700">{t("common.userExists")}</span>}
      {status === "not_found" && <span className="text-gray-500">{t("mappings.destinationExternal")}</span>}
      {status === "invalid" && <span className="text-red-600">{t("common.invalidUsername")}</span>}
    </p>
  );
}
