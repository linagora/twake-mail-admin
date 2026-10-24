import { useState } from "react";
import { Contact } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { CollectionCount, CollectionCountBadge, ExportCollectionButton, ImportCollectionButton } from "@/components/custom/dav-collection-actions";
import { RunTaskResponse } from "@/modules/common-tasks/types";
import { DomainAddressBookId, exportDomainAddressBook, getDomainAddressBookContactCount, importDomainAddressBook } from "../api-client";
import ClearAddressBookButton from "./clear-address-book-button";
import CopyAddressBookButton from "./copy-address-book-button";
import { SectionToggle, useSectionOpen } from "@/components/custom/collapsible-section";

const LABEL_KEYS: Record<DomainAddressBookId, string> = {
  dab: "domains.addressBookCounts.dab",
  "domain-members": "domains.addressBookCounts.domainMembers",
};

// What each address book holds and who fills it
const HINT_KEYS: Record<DomainAddressBookId, string> = {
  dab: "domains.addressBookCounts.hints.dab",
  "domain-members": "domains.addressBookCounts.hints.domainMembers",
};

// The technical id shown after the name, where it differs from the name
const SHOWS_ID: Record<DomainAddressBookId, boolean> = { dab: true, "domain-members": false };

// Stable references: the badge re-reads its counter whenever its function changes.
const countContacts = (domain: string, addressBookId: string): Promise<CollectionCount> =>
  getDomainAddressBookContactCount(domain, addressBookId as DomainAddressBookId);

const exportContacts = (domain: string, addressBookId: string): Promise<Blob> =>
  exportDomainAddressBook(domain, addressBookId as DomainAddressBookId);

const importContacts = (domain: string, addressBookId: string, vcards: string): Promise<RunTaskResponse> =>
  importDomainAddressBook(domain, addressBookId as DomainAddressBookId, vcards);

interface AddressBookPermissions {
  count: boolean;
  export: boolean;
  import: boolean;
  clear: boolean;
  copy: boolean;
}

const isVisible = (permissions: AddressBookPermissions): boolean =>
  permissions.count || permissions.export || permissions.import || permissions.clear || permissions.copy;

function AddressBookRow({
  domain,
  addressBookId,
  permissions,
}: {
  domain: string;
  addressBookId: DomainAddressBookId;
  permissions: AddressBookPermissions;
}) {
  const { t } = useTranslation();
  // Bumped once an import, clear or copy task is over: a new key re-reads the contact counter.
  const [countKey, setCountKey] = useState(0);
  const refreshCount = () => setCountKey((key) => key + 1);

  const label = t(LABEL_KEYS[addressBookId]);
  return (
    <div className="py-1">
      <div data-address-book-row className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          <span>{label}</span>
          {SHOWS_ID[addressBookId] && <span className="ml-2 font-mono text-xs font-normal text-gray-500">{addressBookId}</span>}
        </p>
        {permissions.count && (
          <CollectionCountBadge
            key={countKey}
            owner={domain}
            collectionId={addressBookId}
            count={countContacts}
            icon={Contact}
            title={t("domains.addressBookCounts.contactCount")}
          />
        )}
        {permissions.export && (
          <ExportCollectionButton
            owner={domain}
            collectionId={addressBookId}
            // "example.com-Shared_domain_address_book_dab.vcf": named as shown, not by its id alone
            name={`${domain}-${label}${SHOWS_ID[addressBookId] ? ` ${addressBookId}` : ""}`}
            extension="vcf"
            exportCollection={exportContacts}
            title={t("domains.addressBookCounts.exportTitle")}
            errorTitle={t("domains.addressBookCounts.errorExport")}
            label={t("domains.addressBookCounts.actions.export")}
          />
        )}
        {permissions.import && (
          <ImportCollectionButton
            owner={domain}
            collectionId={addressBookId}
            accept=".vcf,text/vcard"
            importCollection={importContacts}
            title={t("domains.addressBookCounts.importTitle")}
            taskType="domain-addressbook-import"
            errorTitle={t("domains.addressBookCounts.errorImport")}
            onImported={refreshCount}
            label={t("domains.addressBookCounts.actions.import")}
          />
        )}
        {permissions.copy && (
          <CopyAddressBookButton domain={domain} addressBookId={addressBookId} onCopied={refreshCount} />
        )}
        {permissions.clear && (
          <ClearAddressBookButton domain={domain} addressBookId={addressBookId} onCleared={refreshCount} />
        )}
      </div>
      <p className="text-xs text-gray-500">{t(HINT_KEYS[addressBookId], { task: t("domains.calendarTasks.syncButton") })}</p>
    </div>
  );
}

interface Props {
  domain: string;
}

// Contacts held by the domain address books, so that an admin can check they were
// provisioned (after an LDAP sync or a republish task, for instance), export them,
// import vCards or the users of another domain into, or clear the contacts of, the domain
// address book.
export default function DomainAddressBookCounts({ domain }: Props) {
  const { t } = useTranslation();
  const permissions: Record<DomainAddressBookId, AddressBookPermissions> = {
    dab: {
      count: useIsAllowed("GET", "/domains/{domain}/addressbooks/dab/contactCount"),
      export: useIsAllowed("POST", "/domains/{domain}/addressbooks/dab?action=export"),
      import: useIsAllowed("POST", "/domains/{domain}/addressbooks/dab?action=import"),
      clear: useIsAllowed("DELETE", "/domains/{domain}/addressbooks/dab/contacts"),
      copy: useIsAllowed("POST", "/domains/{domain}/addressbooks/dab?action=copyFrom"),
    },
    // Fed by the LDAP synchronization of the domain members: the server rejects imports,
    // clears and copies.
    "domain-members": {
      count: useIsAllowed("GET", "/domains/{domain}/addressbooks/domain-members/contactCount"),
      export: useIsAllowed("POST", "/domains/{domain}/addressbooks/domain-members?action=export"),
      import: false,
      clear: false,
      copy: false,
    },
  };
  const [open, setOpen, openContentId] = useSectionOpen("address-book-counts");

  const addressBookIds = (Object.keys(permissions) as DomainAddressBookId[])
    .filter((id) => isVisible(permissions[id]));

  if (addressBookIds.length === 0) return null;

  return (
    <div className="mt-6">
      <SectionToggle open={open} onToggle={() => setOpen(!open)} controls={openContentId}>
        {t("domains.addressBookCounts.title")}
      </SectionToggle>

      {open && (
        <div id={openContentId} className="mt-2 space-y-1">
          {addressBookIds.map((id) => (
            <AddressBookRow key={id} domain={domain} addressBookId={id} permissions={permissions[id]} />
          ))}
        </div>
      )}
    </div>
  );
}
