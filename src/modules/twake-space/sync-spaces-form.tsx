import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { SpaceSyncScope, syncScopeProblem } from "./space";

interface Props {
  initialValues: SpaceSyncScope;
  onChange: (scope: SpaceSyncScope) => void;
}

/** Which spaces to sync: the space ID only makes sense, and is only enabled, within an organization. */
export default function SyncSpacesForm({ initialValues, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const [organizationId, setOrganizationId] = useState(initialValues.organizationId);
  const [spaceId, setSpaceId] = useState(initialValues.spaceId);
  const hasOrganization = organizationId.trim() !== "";
  // Emptying the organization drops the space ID it scoped
  const scopedSpaceId = hasOrganization ? spaceId : "";
  const problem = syncScopeProblem({ organizationId, spaceId: scopedSpaceId });

  useEffect(() => {
    onChange({ organizationId, spaceId: scopedSpaceId });
  }, [organizationId, scopedSpaceId, onChange]);

  return (
    <div className="space-y-3">
      <p className="text-sm">{t("twakeSpace.sync.help")}</p>
      <div className="space-y-1">
        <label htmlFor={`${id}-organization`} className="text-sm font-medium">{t("twakeSpace.organizationIdOptional")}</label>
        <Input id={`${id}-organization`} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="org-1" />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-space`} className="text-sm font-medium">{t("twakeSpace.spaceIdOptional")}</label>
        <Input
          id={`${id}-space`}
          value={scopedSpaceId}
          disabled={!hasOrganization}
          onChange={(e) => setSpaceId(e.target.value)}
          placeholder="11111111-1111-1111-1111-111111111111"
          aria-invalid={problem !== null}
        />
        <p className="text-xs text-muted-foreground">{t("twakeSpace.sync.spaceHint")}</p>
        {problem && <p className="text-xs text-red-600">{t(problem)}</p>}
      </div>
    </div>
  );
}
