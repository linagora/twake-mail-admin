import { useTranslation } from "react-i18next";
import { isNearLimit, TextProblem } from "./size-limits";

interface Props {
  id: string;
  value: string;
  max: number;
  problem: TextProblem | null;
}

/** Under a size-limited field: why its value is refused, else a counter once it nears the limit. */
export default function FieldLimitHint({ id, value, max, problem }: Props) {
  const { t } = useTranslation();
  if (problem) {
    return (
      <p id={id} role="alert" className="text-xs text-red-600 mt-0.5">
        {problem.kind === "required"
          ? t("users.sizeLimits.required")
          : t("users.sizeLimits.tooLong", { count: problem.max, length: problem.length })}
      </p>
    );
  }
  return isNearLimit(value, max)
    ? <p id={id} className="text-xs text-gray-500 mt-0.5 text-right">{`${value.length} / ${max}`}</p>
    : null;
}
