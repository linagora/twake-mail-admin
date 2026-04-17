import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, AlertTriangle, Loader2, Save } from "lucide-react";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import {
  getDomainContacts,
  getDomainContact,
  createDomainContact,
  updateDomainContact,
  deleteDomainContact,
} from "../api-client";
import { DomainContact } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  domain: string;
}

export default function DomainContacts({ domain }: Props) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const canView = useIsAllowed("GET", "/domains/{domain}/contacts");
  const canCreate = useIsAllowed("POST", "/domains/{domain}/contacts");
  const canEdit = useIsAllowed("PUT", "/domains/{domain}/contacts/{username}");
  const canDelete = useIsAllowed("DELETE", "/domains/{domain}/contacts/{username}");

  const fetchContacts = useCallback(() => getDomainContacts(domain), [domain]);
  const { data: contacts, isLoading, error, refresh } = useFetchData<string[]>(fetchContacts);

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createFirstname, setCreateFirstname] = useState("");
  const [createSurname, setCreateSurname] = useState("");
  const [creating, setCreating] = useState(false);

  // View modal
  const [viewContact, setViewContact] = useState<DomainContact | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Edit modal
  const [editContact, setEditContact] = useState<DomainContact | null>(null);
  const [editFirstname, setEditFirstname] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  if (!canView) return null;

  // Extract username part from email (part before @)
  const usernameFromEmail = (email: string) => email.split("@")[0] || email;

  const handleCreate = async () => {
    const email = createEmail.trim();
    if (!email) return;
    setCreating(true);
    try {
      const payload: { emailAddress: string; firstname?: string; surname?: string } = { emailAddress: email };
      if (createFirstname.trim()) payload.firstname = createFirstname.trim();
      if (createSurname.trim()) payload.surname = createSurname.trim();
      await createDomainContact(domain, payload);
      toast({ title: "Contact created" });
      setCreateEmail("");
      setCreateFirstname("");
      setCreateSurname("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({
        title: "Error creating contact",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (email: string) => {
    const confirmed = await confirm({
      header: "Delete Contact",
      message: `Delete contact "${email}" from ${domain}?`,
    });
    if (!confirmed) return;
    try {
      await deleteDomainContact(domain, usernameFromEmail(email));
      toast({ title: "Contact deleted" });
      await refresh();
    } catch (err) {
      toast({
        title: "Error deleting contact",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const openView = async (email: string) => {
    setViewLoading(true);
    setViewContact(null);
    try {
      const contact = await getDomainContact(domain, usernameFromEmail(email));
      setViewContact(contact);
    } catch (err) {
      toast({
        title: "Error fetching contact",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = (contact: DomainContact) => {
    setViewContact(null);
    setEditContact(contact);
    setEditFirstname(contact.firstname ?? "");
    setEditSurname(contact.surname ?? "");
  };

  const openEditFromList = async (email: string) => {
    try {
      const contact = await getDomainContact(domain, usernameFromEmail(email));
      setEditContact(contact);
      setEditFirstname(contact.firstname ?? "");
      setEditSurname(contact.surname ?? "");
    } catch (err) {
      toast({
        title: "Error fetching contact",
        description: <ErrorDisplayer error={err} />,
      });
    }
  };

  const handleUpdate = async () => {
    if (!editContact) return;
    setSaving(true);
    try {
      const payload: { firstname?: string; surname?: string } = {};
      payload.firstname = editFirstname.trim();
      payload.surname = editSurname.trim();
      await updateDomainContact(domain, usernameFromEmail(editContact.emailAddress), payload);
      toast({ title: "Contact updated" });
      setEditContact(null);
      await refresh();
    } catch (err) {
      toast({
        title: "Error updating contact",
        description: <ErrorDisplayer error={err} />,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Domain Contacts
          {contacts && (
            <span className="text-sm font-normal text-gray-500">
              ({contacts.length})
            </span>
          )}
        </button>
        {open && canCreate && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title="Create contact"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md mb-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Contacts are automatically populated from LDAP. This section allows manual corrections by an administrator.</span>
          </div>

          {showCreate && (
            <div className="p-4 bg-blue-50 rounded-2 mb-2 space-y-2">
              <h5 className="text-sm font-semibold">New Contact</h5>
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="email@domain.tld"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={createFirstname}
                  onChange={(e) => setCreateFirstname(e.target.value)}
                  placeholder="Firstname (optional)"
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={createSurname}
                  onChange={(e) => setCreateSurname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Surname (optional)"
                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={creating || !createEmail.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {contacts && (
            <div>
              {sorted.map((email, index) => (
                <div
                  key={email}
                  className="p-4 bg-gray-50 rounded-2 my-2 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => openView(email)}
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {email}
                  </h4>
                  <div className="flex gap-1">
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditFromList(email); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Edit contact"
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(email); }}
                        className="p-2 rounded-md hover:bg-gray-200"
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No domain contacts.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* View modal */}
      <Dialog open={!!viewContact || viewLoading} onOpenChange={(v) => { if (!v) { setViewContact(null); setViewLoading(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {viewLoading && !viewContact && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          )}
          {viewContact && (
            <div className="space-y-3 text-sm">
              <Row label="ID" value={viewContact.id} />
              <Row label="Email" value={viewContact.emailAddress} />
              <Row label="Firstname" value={viewContact.firstname || "—"} />
              <Row label="Surname" value={viewContact.surname || "—"} />
              {canEdit && (
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => openEdit(viewContact)}>
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editContact} onOpenChange={(v) => { if (!v) setEditContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact — {editContact?.emailAddress}</DialogTitle>
          </DialogHeader>
          {editContact && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Firstname</label>
                <input
                  type="text"
                  value={editFirstname}
                  onChange={(e) => setEditFirstname(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Surname</label>
                <input
                  type="text"
                  value={editSurname}
                  onChange={(e) => setEditSurname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditContact(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleUpdate} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 font-medium min-w-[80px]">{label}:</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
