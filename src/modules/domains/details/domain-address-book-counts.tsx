import { useState } from "react";
import { ChevronDown, ChevronRight, Contact } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { CollectionCount, CollectionCountBadge } from "@/components/custom/dav-collection-actions";
import { DomainAddressBookId, getDomainAddressBookContactCount } from "../api-client";

const LABEL_KEYS: Record<DomainAddressBookId, string> = {
  dab: "domains.addressBookCounts.dab",
  "domain-members": "domains.addressBookCounts.domainMembers",
};

// Stable reference: the badge re-reads its counter whenever this function changes.
const countContacts = (domain: string, addressBookId: string): Promise<CollectionCount> =>
  getDomainAddressBookContactCount(domain, addressBookId as DomainAddressBookId);

interface Props {
  domain: string;
}

// Number of contacts held by the domain address books, so that an admin can check
// they were provisioned (after an LDAP sync or a republish task, for instance).
export default function DomainAddressBookCounts({ domain }: Props) {
  const { t } = useTranslation();
  const canCountDab = useIsAllowed("GET", "/domains/{domain}/addressbooks/dab/contactCount");
  const canCountMembers = useIsAllowed("GET", "/domains/{domain}/addressbooks/domain-members/contactCount");
  const [open, setOpen] = useState(false);

  const addressBookIds = ([] as DomainAddressBookId[])
    .concat(canCountDab ? ["dab"] : [])
    .concat(canCountMembers ? ["domain-members"] : []);

  if (addressBookIds.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("domains.addressBookCounts.title")}
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {addressBookIds.map((id) => (
            <div key={id} className="flex items-center gap-2 py-1">
              <p className="font-medium">{t(LABEL_KEYS[id])}</p>
              <CollectionCountBadge
                owner={domain}
                collectionId={id}
                count={countContacts}
                icon={Contact}
                title={t("domains.addressBookCounts.contactCount")}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
