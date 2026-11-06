import { useTranslation } from "react-i18next";
import { exceededRegexLimits, MAX_REGEX_LENGTH } from "./regex-limits";

interface Props {
  mapping: string;
  // What the server does with it: refuses a new mapping, skips a stored one
  consequence: "refused" | "notApplied";
}

/** Which RE2 limits a regex mapping exceeds, and what follows: nothing when it exceeds none. */
export default function RegexLimitsWarning({ mapping, consequence }: Props) {
  const { t } = useTranslation();
  const limits = exceededRegexLimits(mapping);
  if (limits.length === 0) return null;
  const reasons = limits.map((limit) => t(`mappings.regexLimits.${limit}`, { max: MAX_REGEX_LENGTH }));
  return (
    <p className="mt-1 text-xs text-amber-800">
      {[t(`mappings.regexLimits.${consequence}`), ...reasons].join(" ")}
    </p>
  );
}
