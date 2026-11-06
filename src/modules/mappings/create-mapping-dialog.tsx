import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import FormDialog, { FIELD_CLASS } from "@/components/custom/form-dialog";
import { useToast } from "@/hooks/use-toast";
import { createAddressMapping, createDomainMapping, createRegexMapping } from "./api-client";
import { DestinationLine, SourceLine, useSourceCheck } from "@/components/custom/address-checks";
import { MAX_REGEX_LENGTH } from "./regex-limits";
import RegexLimitsWarning from "./regex-limits-warning";

export type MappingKind = "address" | "regex" | "domain";

const KINDS: Record<MappingKind, {
  sourcePlaceholder: string;
  destinationPlaceholder: string;
  created: string;
  create: (source: string, destination: string) => Promise<unknown>;
  // What the type does, under the type select
  hint: string;
  // Source and destination are addresses, checked against the accounts
  checksAccounts?: boolean;
  // The destination is a regex mapping, checked against the limits of RE2
  checksRegexLimits?: boolean;
}> = {
  address: {
    sourcePlaceholder: "mappings.sourcePlaceholder",
    destinationPlaceholder: "mappings.destinationPlaceholder",
    created: "mappings.addressCreated",
    create: createAddressMapping,
    hint: "mappings.typeHint.address",
    checksAccounts: true,
  },
  regex: {
    sourcePlaceholder: "mappings.mappingSourcePlaceholder",
    destinationPlaceholder: "mappings.regexPlaceholder",
    created: "mappings.regexCreated",
    create: createRegexMapping,
    hint: "mappings.typeHint.regex",
    checksRegexLimits: true,
  },
  domain: {
    sourcePlaceholder: "mappings.domainSourcePlaceholder",
    destinationPlaceholder: "mappings.domainDestinationPlaceholder",
    created: "mappings.domainCreated",
    create: createDomainMapping,
    hint: "mappings.domainHint",
  },
};

interface Props {
  open: boolean;
  // The kinds the operator may create, in the order of the type select
  kinds: MappingKind[];
  onClose: () => void;
  onCreated: () => void;
}

/** The modal each "Add … mapping" button of the toolbar opens: a source and its destination. */
export default function CreateMappingDialog({ open, kinds, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const idPrefix = useId();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [kind, setKind] = useState<MappingKind>(kinds[0] ?? "address");
  const config = KINDS[kinds.includes(kind) ? kind : kinds[0] ?? "address"];
  // Only an address source can be an account whose mail would be diverted
  const sourceCheck = useSourceCheck(config.checksAccounts ? source : "");

  const close = () => {
    setSource("");
    setDestination("");
    onClose();
  };

  const handleCreate = async () => {
    await config.create(source.trim(), destination.trim());
    toast({ title: t(config.created) });
    onCreated();
    setSource("");
    setDestination("");
  };

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={t("mappings.addTitle")}
      submitLabel={t("common.create")}
      submitDisabled={!source.trim() || !destination.trim() || sourceCheck.blocking}
      onSubmit={handleCreate}
    >
      {kinds.length > 1 && (
        <div>
          <label htmlFor={`${idPrefix}-kind`} className="text-sm font-medium">{t("mappings.type")}</label>
          <select id={`${idPrefix}-kind`} value={kind} onChange={(e) => setKind(e.target.value as MappingKind)} className={FIELD_CLASS}>
            {kinds.map((k) => <option key={k} value={k}>{t(`mappings.kinds.${k}`)}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t(config.hint, { max: MAX_REGEX_LENGTH })}</p>
      <div>
        <label htmlFor={`${idPrefix}-source`} className="text-sm font-medium">{t("mappings.source")}</label>
        <input id={`${idPrefix}-source`} type="text" autoFocus value={source} onChange={(e) => setSource(e.target.value)}
          placeholder={t(config.sourcePlaceholder)} className={FIELD_CLASS} />
        {config.checksAccounts && <SourceLine source={source} destination={destination} status={sourceCheck.status} />}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-destination`} className="text-sm font-medium">{t("mappings.destination")}</label>
        <input id={`${idPrefix}-destination`} type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
          placeholder={t(config.destinationPlaceholder)} className={FIELD_CLASS} />
        {config.checksAccounts && <DestinationLine destination={destination} />}
        {config.checksRegexLimits && (
          <div role="status">
            {/* Trimmed as it will be sent */}
            <RegexLimitsWarning mapping={destination.trim()} consequence="refused" />
          </div>
        )}
      </div>
    </FormDialog>
  );
}
