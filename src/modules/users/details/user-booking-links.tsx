import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, Pencil, Trash2, RefreshCw, Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserBookingLinks, createUserBookingLink, updateUserBookingLink, deleteUserBookingLink, resetUserBookingLinkPublicId, getUserCalendars } from "../api-client";
import { BookingLink, AvailabilityRule, CreateBookingLinkPayload, UpdateBookingLinkPayload, GetUserCalendarsResponseType, UserCalendar } from "../types";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  username: string;
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

interface CalendarOption {
  value: string;
  label: string;
}

function calendarHref(calendar: UserCalendar): string {
  // The booking-links API expects the CalDAV collection path without the
  // .json suffix used by the calendar listing's self href.
  return (calendar._links?.self?.href ?? "").replace(/\.json$/, "");
}

function calendarLabel(calendar: UserCalendar): string {
  return calendar["dav:name"]?.trim() || calendarHref(calendar);
}

// A dropdown of the user's calendars (by name) instead of a raw URL field.
// The stored value is the calendar's self href, which is exactly what the
// booking-links API expects as calendarUrl. Falls back to a free-text input
// when no calendar can be listed, and preserves an unknown existing value.
function CalendarSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CalendarOption[];
}) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/calendars/..."
        className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  const known = options.some((o) => o.value === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">{t("users.bookingLinks.selectCalendar")}</option>
      {!known && value && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

const EMPTY_RULE: AvailabilityRule = { type: "weekly", dayOfWeek: "MON", start: "09:00", end: "17:00", timeZone: "UTC" };

function RulesEditor({
  rules,
  onChange,
}: {
  rules: AvailabilityRule[];
  onChange: (rules: AvailabilityRule[]) => void;
}) {
  const { t } = useTranslation();

  const update = (index: number, patch: Partial<AvailabilityRule>) => {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const remove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {rules.map((rule, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-gray-50">
          <select
            value={rule.dayOfWeek ?? "MON"}
            onChange={(e) => update(i, { dayOfWeek: e.target.value })}
            className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{t(`users.bookingLinks.days.${d}`)}</option>
            ))}
          </select>
          <input
            type="time"
            value={rule.start ?? "09:00"}
            onChange={(e) => update(i, { start: e.target.value })}
            className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="time"
            value={rule.end ?? "17:00"}
            onChange={(e) => update(i, { end: e.target.value })}
            className="px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={rule.timeZone ?? ""}
            onChange={(e) => update(i, { timeZone: e.target.value })}
            placeholder={t("users.bookingLinks.timeZone")}
            className="flex-1 min-w-[120px] px-2 py-1 border rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => remove(i)}
            className="p-1 rounded-md hover:bg-gray-200 transition"
            title={t("users.bookingLinks.removeRule")}
            type="button"
          >
            <Minus className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rules, { ...EMPTY_RULE }])}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        {t("users.bookingLinks.addRule")}
      </Button>
    </div>
  );
}

function BookingLinkRow({
  link,
  calendarOptions,
  canEdit,
  canDelete,
  canReset,
  onEdit,
  onDelete,
  onReset,
}: {
  link: BookingLink;
  calendarOptions: CalendarOption[];
  canEdit: boolean;
  canDelete: boolean;
  canReset: boolean;
  onEdit: (link: BookingLink) => void;
  onDelete: (link: BookingLink) => void;
  onReset: (link: BookingLink) => void;
}) {
  const { t } = useTranslation();
  const rulesCount = link.availabilityRules?.length ?? 0;
  const calendarName = calendarOptions.find((o) => o.value === link.calendarUrl)?.label;

  return (
    <div className="flex items-start gap-3 py-1">
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${link.active ? "bg-green-500" : "bg-gray-400"}`}
        title={link.active ? t("users.bookingLinks.active") : t("users.bookingLinks.inactive")}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate" title={link.name || link.publicId}>
          {link.name || <span className="font-mono">{link.publicId}</span>}
        </p>
        {link.name && (
          <p className="text-xs text-gray-400 font-mono truncate" title={link.publicId}>{link.publicId}</p>
        )}
        {link.description && (
          <p className="text-xs text-gray-500 truncate" title={link.description}>{link.description}</p>
        )}
        <p className="text-xs text-gray-400 truncate" title={link.calendarUrl}>{calendarName ?? link.calendarUrl}</p>
        <p className="text-xs text-gray-400">
          {link.durationMinutes} min
          {rulesCount > 0 && (
            <span className="ml-2">
              · {t("users.bookingLinks.rulesCount", { count: rulesCount })}
            </span>
          )}
        </p>
      </div>
      {canReset && (
        <button
          onClick={() => onReset(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.resetTitle")}
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => onEdit(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.editTitle")}
        >
          <Pencil className="w-3.5 h-3.5 text-blue-600" />
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => onDelete(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.deleteTitle")}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
        </button>
      )}
    </div>
  );
}

const EMPTY_CREATE: CreateBookingLinkPayload = {
  calendarUrl: "",
  durationMinutes: 30,
  active: true,
};

export default function UserBookingLinks({ username }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();

  const canView = useIsAllowed("GET", "/users/{username}/booking-links");
  const canCreate = useIsAllowed("POST", "/users/{username}/booking-links");
  const canEdit = useIsAllowed("PATCH", "/users/{username}/booking-links/{publicId}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/booking-links/{publicId}");
  const canReset = useIsAllowed("POST", "/users/{username}/booking-links/{publicId}/reset");

  const canViewCalendars = useIsAllowed("GET", "/users/{username}/calendars");

  const fetchLinks = useCallback(() => getUserBookingLinks(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<BookingLink[]>(canView ? fetchLinks : null);

  const fetchCalendars = useCallback(() => getUserCalendars(username), [username]);
  const { data: calendarsData } = useFetchData<GetUserCalendarsResponseType>(
    canView && canViewCalendars ? fetchCalendars : null
  );
  const calendarOptions: CalendarOption[] = (calendarsData?._embedded?.["dav:calendar"] ?? [])
    .map((c) => ({ value: calendarHref(c), label: calendarLabel(c) }))
    .filter((o) => o.value);

  const [open, setOpen] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateBookingLinkPayload>({ ...EMPTY_CREATE });
  const [createRules, setCreateRules] = useState<AvailabilityRule[]>([]);
  const [creating, setCreating] = useState(false);

  const [editLink, setEditLink] = useState<BookingLink | null>(null);
  const [editForm, setEditForm] = useState<UpdateBookingLinkPayload>({});
  const [editRules, setEditRules] = useState<AvailabilityRule[] | null>(null);
  const [editClearRules, setEditClearRules] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!canView) return null;

  const links = data ?? [];

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: CreateBookingLinkPayload = { ...createForm };
      const name = createForm.name?.trim();
      const description = createForm.description?.trim();
      if (name) payload.name = name; else delete payload.name;
      if (description) payload.description = description; else delete payload.description;
      if (createRules.length > 0) payload.availabilityRules = createRules;
      await createUserBookingLink(username, payload);
      toast({ title: t("users.bookingLinks.created") });
      setCreateForm({ ...EMPTY_CREATE });
      setCreateRules([]);
      setShowCreate(false);
      await refresh();
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorCreate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (link: BookingLink) => {
    setEditLink(link);
    setEditForm({
      calendarUrl: link.calendarUrl,
      durationMinutes: link.durationMinutes,
      active: link.active,
      name: link.name,
      description: link.description,
    });
    setEditRules(link.availabilityRules ? [...link.availabilityRules] : []);
    setEditClearRules(false);
  };

  const handleUpdate = async () => {
    if (!editLink) return;
    setSaving(true);
    try {
      const payload: UpdateBookingLinkPayload = { ...editForm };
      // Blank name/description map to removal (null) on the backend.
      if (editForm.name !== undefined) payload.name = editForm.name?.trim() || null;
      if (editForm.description !== undefined) payload.description = editForm.description?.trim() || null;
      if (editClearRules) {
        payload.availabilityRules = null;
      } else if (editRules !== null) {
        payload.availabilityRules = editRules.length > 0 ? editRules : undefined;
      }
      await updateUserBookingLink(username, editLink.publicId, payload);
      toast({ title: t("users.bookingLinks.updated") });
      setEditLink(null);
      await refresh();
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorUpdate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (link: BookingLink) => {
    const confirmed = await confirm({
      header: t("users.bookingLinks.deleteTitle"),
      message: t("users.bookingLinks.deleteConfirm"),
    });
    if (!confirmed) return;
    try {
      await deleteUserBookingLink(username, link.publicId);
      toast({ title: t("users.bookingLinks.deleted") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorDelete"), description: <ErrorDisplayer error={err} /> });
    }
  };

  const handleReset = async (link: BookingLink) => {
    const confirmed = await confirm({
      header: t("users.bookingLinks.resetTitle"),
      message: t("users.bookingLinks.resetConfirm"),
    });
    if (!confirmed) return;
    try {
      await resetUserBookingLinkPublicId(username, link.publicId);
      toast({ title: t("users.bookingLinks.resetDone") });
      await refresh();
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorReset"), description: <ErrorDisplayer error={err} /> });
    }
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {t("users.bookingLinks.title")}
        {data && (
          <span className="text-sm font-normal text-gray-500">({links.length})</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {isLoading && <div className="h-[40px] rounded-2 animate-pulse bg-gray-200" />}
          {error && <p className="text-red-500">Error: {error}</p>}

          {canCreate && (
            <div className="mb-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {t("users.bookingLinks.create")}
              </Button>
            </div>
          )}

          {data && links.length === 0 && (
            <p className="text-sm text-gray-500">{t("users.bookingLinks.empty")}</p>
          )}

          {links.map((link) => (
            <BookingLinkRow
              key={link.publicId}
              link={link}
              calendarOptions={calendarOptions}
              canEdit={canEdit}
              canDelete={canDelete}
              canReset={canReset}
              onEdit={openEdit}
              onDelete={handleDelete}
              onReset={handleReset}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(v) => { if (!v) { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); setCreateRules([]); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("users.bookingLinks.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("users.bookingLinks.calendarUrl")} *</label>
              <CalendarSelect
                value={createForm.calendarUrl}
                onChange={(value) => setCreateForm((f) => ({ ...f, calendarUrl: value }))}
                options={calendarOptions}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.bookingLinks.name")}</label>
              <input
                type="text"
                value={createForm.name ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("users.bookingLinks.namePlaceholder")}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.bookingLinks.description")}</label>
              <textarea
                value={createForm.description ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("users.bookingLinks.descriptionPlaceholder")}
                rows={2}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("users.bookingLinks.durationMinutes")} *</label>
              <input
                type="number"
                min={1}
                value={createForm.durationMinutes}
                onChange={(e) => setCreateForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || 1 }))}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-active"
                checked={createForm.active}
                onChange={(e) => setCreateForm((f) => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="create-active" className="text-sm font-medium">{t("users.bookingLinks.active")}</label>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">{t("users.bookingLinks.availabilityRules")}</label>
              <RulesEditor rules={createRules} onChange={setCreateRules} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setCreateForm({ ...EMPTY_CREATE }); setCreateRules([]); }}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !createForm.calendarUrl.trim() || !createForm.durationMinutes}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("common.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editLink} onOpenChange={(v) => { if (!v) setEditLink(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("users.bookingLinks.editTitle")}</DialogTitle>
          </DialogHeader>
          {editLink && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">{t("users.bookingLinks.calendarUrl")}</label>
                <CalendarSelect
                  value={editForm.calendarUrl ?? ""}
                  onChange={(value) => setEditForm((f) => ({ ...f, calendarUrl: value }))}
                  options={calendarOptions}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.bookingLinks.name")}</label>
                <input
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("users.bookingLinks.namePlaceholder")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.bookingLinks.description")}</label>
                <textarea
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("users.bookingLinks.descriptionPlaceholder")}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("users.bookingLinks.durationMinutes")}</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.durationMinutes ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || undefined }))}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editForm.active ?? false}
                  onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="edit-active" className="text-sm font-medium">{t("users.bookingLinks.active")}</label>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">{t("users.bookingLinks.availabilityRules")}</label>
                  {!editClearRules && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditClearRules(true); setEditRules([]); }}
                    >
                      {t("users.bookingLinks.clearRules")}
                    </Button>
                  )}
                  {editClearRules && (
                    <span className="text-xs text-orange-500">{t("users.bookingLinks.clearRulesWarning")}</span>
                  )}
                </div>
                {!editClearRules && (
                  <RulesEditor rules={editRules ?? []} onChange={setEditRules} />
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditLink(null)}>
                  {t("common.cancel")}
                </Button>
                <Button size="sm" onClick={handleUpdate} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
