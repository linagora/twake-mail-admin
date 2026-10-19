import { useCallback, useId, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Minus, Copy, Pencil, Trash2, RefreshCw, Loader2, Save, CalendarX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getUserBookingLinks, createUserBookingLink, updateUserBookingLink, deleteUserBookingLink, resetUserBookingLinkPublicId, deleteUserBookingLinkEvents, getUserCalendars } from "../api-client";
import { BookingLink, AvailabilityRule, CreateBookingLinkPayload, UpdateBookingLinkPayload, GetUserCalendarsResponseType, UserCalendar } from "../types";
import { isBookableCalendar } from "./bookable-calendars";
import { buildOwnerEmailMap, ownerEmail } from "./calendar-owner";
import { isValidDurationMinutes, parseDurationMinutes } from "./booking-link-duration";
import { areValidRules, DEFAULT_RULE_END, DEFAULT_RULE_START, listTimeZones, ruleErrors } from "./booking-link-rules";
import { useToast } from "@/hooks/use-toast";
import { useTaskCreatedToast } from "@/hooks/use-task-created-toast";
import { useConfirm } from "@/hooks/use-confirm";
import ErrorDisplayer from "@/components/custom/error-displayer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDomain } from "@/modules/domain-admin/domain-context";
import { getRegisteredUsers } from "@/modules/registered-users/api-client";
import { RegisteredUser } from "@/modules/registered-users/types";

interface Props {
  username: string;
  // Changes whenever the Calendars section of the page creates, renames or deletes a calendar.
  calendarsVersion?: number;
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

// A delegated calendar keeps the name of its source one (often "#default"): its owner tells it
// apart from the user's own calendar of the same name.
function calendarLabel(calendar: UserCalendar, ownerEmails: Record<string, string>): string {
  const name = calendar["dav:name"]?.trim() || calendarHref(calendar);
  const owner = ownerEmail(calendar, ownerEmails);
  return owner ? `${name} (${owner})` : name;
}

// A dropdown of the user's calendars (by name) instead of a raw URL field.
// The stored value is the calendar's self href, which is exactly what the
// booking-links API expects as calendarUrl. Falls back to a free-text input
// when no calendar can be listed. An existing value that is not offered (its
// calendar was deleted, or can no longer be booked) stays displayed but is
// flagged: the admin must pick another calendar before saving.
function CalendarSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: CalendarOption[];
}) {
  const { t } = useTranslation();

  if (options.length === 0) {
    return (
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/calendars/..."
        className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  const unavailable = !!value && !isOfferedCalendar(value, options);
  const errorId = `${id}-error`;
  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={unavailable}
        aria-describedby={unavailable ? errorId : undefined}
        className={`w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${unavailable ? "border-red-500" : ""}`}
      >
        <option value="">{t("users.bookingLinks.selectCalendar")}</option>
        {unavailable && <option value={value} disabled>{t("users.bookingLinks.calendarUnavailableOption")}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {unavailable && (
        <p id={errorId} className="text-xs text-red-500 mt-1">{t("users.bookingLinks.calendarUnavailable")}</p>
      )}
    </>
  );
}

// Without any listed calendar the field is free text: whatever is typed is accepted.
function isOfferedCalendar(value: string, options: CalendarOption[]): boolean {
  return options.length === 0 || options.some((o) => o.value === value);
}

const EMPTY_RULE: AvailabilityRule = { type: "weekly", dayOfWeek: "MON", start: DEFAULT_RULE_START, end: DEFAULT_RULE_END, timeZone: "UTC" };

const TIME_ZONES = listTimeZones();

function RulesEditor({
  rules,
  onChange,
}: {
  rules: AvailabilityRule[];
  onChange: (rules: AvailabilityRule[]) => void;
}) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const timeZonesId = `${idPrefix}-time-zones`;

  const update = (index: number, patch: Partial<AvailabilityRule>) => {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const remove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const duplicate = (index: number) => {
    onChange([
      ...rules.slice(0, index + 1),
      { ...rules[index] },
      ...rules.slice(index + 1),
    ]);
  };

  return (
    <div className="space-y-2">
      {rules.length > 0 && (
        // Bound the rule list height so a long availability set (10+ rules)
        // scrolls on its own instead of pushing the dialog past the screen.
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {rules.map((rule, i) => {
            const errors = ruleErrors(rule);
            const rangeErrorId = `${idPrefix}-${i}-range-error`;
            const timeZoneErrorId = `${idPrefix}-${i}-time-zone-error`;
            return (
              <div key={i} className="p-2 border rounded-md bg-gray-50">
                {/* flex-wrap: on a phone the fields exceed the dialog width; let them wrap
                    instead of widening the whole dialog past the screen. */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={rule.dayOfWeek ?? "MON"}
                    onChange={(e) => update(i, { dayOfWeek: e.target.value })}
                    aria-label={t("users.bookingLinks.ruleDay")}
                    className="shrink-0 px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{t(`users.bookingLinks.days.${d}`)}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={rule.start ?? DEFAULT_RULE_START}
                    onChange={(e) => update(i, { start: e.target.value })}
                    aria-label={t("users.bookingLinks.ruleStart")}
                    aria-invalid={errors.range}
                    aria-describedby={errors.range ? rangeErrorId : undefined}
                    className={`shrink-0 px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${errors.range ? "border-red-500" : ""}`}
                  />
                  <span className="shrink-0 text-xs text-gray-400">→</span>
                  <input
                    type="time"
                    value={rule.end ?? DEFAULT_RULE_END}
                    onChange={(e) => update(i, { end: e.target.value })}
                    aria-label={t("users.bookingLinks.ruleEnd")}
                    aria-invalid={errors.range}
                    aria-describedby={errors.range ? rangeErrorId : undefined}
                    className={`shrink-0 px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${errors.range ? "border-red-500" : ""}`}
                  />
                  <input
                    type="text"
                    list={TIME_ZONES.length > 0 ? timeZonesId : undefined}
                    value={rule.timeZone ?? ""}
                    onChange={(e) => update(i, { timeZone: e.target.value })}
                    placeholder={t("users.bookingLinks.timeZone")}
                    aria-label={t("users.bookingLinks.timeZone")}
                    aria-invalid={errors.timeZone}
                    aria-describedby={errors.timeZone ? timeZoneErrorId : undefined}
                    className={`flex-1 min-w-[80px] px-2 py-1 border rounded-md text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${errors.timeZone ? "border-red-500" : ""}`}
                  />
                  <button
                    onClick={() => duplicate(i)}
                    className="shrink-0 p-1 rounded-md hover:bg-gray-200 transition"
                    title={t("users.bookingLinks.duplicateRule")}
                    type="button"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="shrink-0 p-1 rounded-md hover:bg-gray-200 transition"
                    title={t("users.bookingLinks.removeRule")}
                    type="button"
                  >
                    <Minus className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </div>
                {errors.range && (
                  <p id={rangeErrorId} className="text-xs text-red-500 mt-1">{t("users.bookingLinks.ruleRangeInvalid")}</p>
                )}
                {errors.timeZone && (
                  <p id={timeZoneErrorId} className="text-xs text-red-500 mt-1">{t("users.bookingLinks.timeZoneInvalid")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {TIME_ZONES.length > 0 && (
        <datalist id={timeZonesId}>
          {TIME_ZONES.map((zone) => <option key={zone} value={zone} />)}
        </datalist>
      )}
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
  calendarsListed,
  canEdit,
  canDelete,
  canReset,
  canDeleteEvents,
  canDuplicate,
  onEdit,
  onDelete,
  onReset,
  onDeleteEvents,
  onDuplicate,
}: {
  link: BookingLink;
  calendarOptions: CalendarOption[];
  calendarsListed: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReset: boolean;
  canDeleteEvents: boolean;
  canDuplicate: boolean;
  onEdit: (link: BookingLink) => void;
  onDelete: (link: BookingLink) => void;
  onReset: (link: BookingLink) => void;
  onDeleteEvents: (link: BookingLink) => void;
  onDuplicate: (link: BookingLink) => void;
}) {
  const { t } = useTranslation();
  const rulesCount = link.availabilityRules?.length ?? 0;
  const calendarName = calendarOptions.find((o) => o.value === link.calendarUrl)?.label;

  return (
    <div className="flex items-start gap-3 py-1">
      {/* The state is also written out below: the colour alone tells nothing to a screen reader. */}
      <span
        aria-hidden="true"
        className={`inline-block w-2 h-2 rounded-full shrink-0 mt-1.5 ${link.active ? "bg-green-500" : "bg-gray-400"}`}
        title={link.active ? t("users.bookingLinks.active") : t("users.bookingLinks.inactive")}
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate flex items-center gap-1.5" title={link.name || link.publicId}>
          <span
            className="inline-block w-3 h-3 rounded-sm border shrink-0"
            style={{ backgroundColor: link.color || "#6B4ECC" }}
            title={link.color || "#6B4ECC"}
          />
          {link.name || <span className="font-mono">{link.publicId}</span>}
        </p>
        {link.name && (
          <p className="text-xs text-gray-400 font-mono truncate" title={link.publicId}>{link.publicId}</p>
        )}
        {link.description && (
          <p className="text-xs text-gray-500 truncate" title={link.description}>{link.description}</p>
        )}
        {calendarName === undefined && calendarsListed ? (
          // The side service keeps the links of a deleted calendar: flag them so they can be repaired.
          <p className="text-xs text-red-500 truncate" title={link.calendarUrl}>{t("users.bookingLinks.calendarDeleted")}</p>
        ) : (
          <p className="text-xs text-gray-400 truncate" title={link.calendarUrl}>{calendarName ?? link.calendarUrl}</p>
        )}
        <p className="text-xs text-gray-400">
          {!link.active && (
            <span className="mr-2 font-medium text-gray-600">{t("users.bookingLinks.inactive")} ·</span>
          )}
          {link.durationMinutes} min
          {rulesCount > 0 && (
            <span className="ml-2">
              · {t("users.bookingLinks.rulesCount", { count: rulesCount })}
            </span>
          )}
          {link.autoAccept && (
            <span className="ml-2">· {t("users.bookingLinks.autoAccept")}</span>
          )}
        </p>
      </div>
      {canDeleteEvents && (
        <button
          onClick={() => onDeleteEvents(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.deleteEventsTitle")}
        >
          <CalendarX className="w-3.5 h-3.5 text-orange-600" />
        </button>
      )}
      {canReset && (
        <button
          onClick={() => onReset(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.resetTitle")}
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}
      {canDuplicate && (
        <button
          onClick={() => onDuplicate(link)}
          className="p-1.5 rounded-md hover:bg-gray-200 transition"
          title={t("users.bookingLinks.duplicateTitle")}
        >
          <Copy className="w-3.5 h-3.5 text-blue-600" />
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

// Keeps the raw text typed by the admin so the field can be emptied and
// retyped; an invalid value is flagged instead of being silently replaced.
function DurationInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const invalid = !isValidDurationMinutes(value);
  const errorId = `${id}-error`;
  return (
    <>
      <input
        id={id}
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className={`w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${invalid ? "border-red-500" : ""}`}
      />
      {invalid && (
        <p id={errorId} className="text-xs text-red-500 mt-1">{t("users.bookingLinks.durationInvalid")}</p>
      )}
    </>
  );
}

// Booking links always carry a color; the backend defaults to this value when
// none is stored, so the create form starts from the same default (see issue #31).
const DEFAULT_COLOR = "#6B4ECC";

const EMPTY_CREATE: CreateBookingLinkPayload = {
  calendarUrl: "",
  durationMinutes: 30,
  active: true,
  color: DEFAULT_COLOR,
};

export default function UserBookingLinks({ username, calendarsVersion }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const toastTaskCreated = useTaskCreatedToast();
  const confirm = useConfirm();

  const canView = useIsAllowed("GET", "/users/{username}/booking-links");
  const canCreate = useIsAllowed("POST", "/users/{username}/booking-links");
  const canEdit = useIsAllowed("PATCH", "/users/{username}/booking-links/{publicId}");
  const canDelete = useIsAllowed("DELETE", "/users/{username}/booking-links/{publicId}");
  const canReset = useIsAllowed("POST", "/users/{username}/booking-links/{publicId}/reset");
  const canDeleteEvents = useIsAllowed("POST", "/users/{username}/booking-links/{publicId}?action=deleteEvents");

  const canViewCalendars = useIsAllowed("GET", "/users/{username}/calendars");

  const fetchLinks = useCallback(() => getUserBookingLinks(username), [username]);
  const { data, isLoading, error, refresh } = useFetchData<BookingLink[]>(canView ? fetchLinks : null);

  const [open, setOpen] = useState(false);

  // The calendars can be created or deleted from the Calendars section of the
  // same page: they are fetched each time this section is expanded, each time
  // a dialog opens and each time that section changes them, so that neither the
  // rows nor the dropdowns show a stale list.
  const fetchCalendars = useCallback(() => getUserCalendars(username), [username]);
  const { data: calendarsData, refresh: refreshCalendars } = useFetchData<GetUserCalendarsResponseType>(
    open && canView && canViewCalendars ? fetchCalendars : null,
    calendarsVersion
  );
  const allCalendars = calendarsData?._embedded?.["dav:calendar"] ?? [];
  const domain = useDomain() || undefined;
  const canRegisteredUsers = useIsAllowed("GET", "/registeredUsers");
  const fetchRegisteredUsers = useCallback(() => getRegisteredUsers(domain), [domain]);
  const { data: registeredUsers } = useFetchData<RegisteredUser[]>(
    open && canView && canViewCalendars && canRegisteredUsers ? fetchRegisteredUsers : null
  );
  const ownerEmails = buildOwnerEmailMap(allCalendars, registeredUsers);
  // Full list, used only to resolve calendar names for display (a link may
  // point to a calendar the user can no longer book on).
  const calendarOptions: CalendarOption[] = allCalendars
    .map((c) => ({ value: calendarHref(c), label: calendarLabel(c, ownerEmails) }))
    .filter((o) => o.value);
  // Restricted list offered in the create/edit dropdowns: only calendars the
  // user can write to (owned or write-delegated), never resources.
  const bookableCalendarOptions: CalendarOption[] = allCalendars
    .filter((c) => isBookableCalendar(c, username))
    .map((c) => ({ value: calendarHref(c), label: calendarLabel(c, ownerEmails) }))
    .filter((o) => o.value);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateBookingLinkPayload>({ ...EMPTY_CREATE });
  const [createRules, setCreateRules] = useState<AvailabilityRule[]>([]);
  const [createDuration, setCreateDuration] = useState(String(EMPTY_CREATE.durationMinutes));
  const [creating, setCreating] = useState(false);

  const [editLink, setEditLink] = useState<BookingLink | null>(null);
  const [editForm, setEditForm] = useState<UpdateBookingLinkPayload>({});
  const [editRules, setEditRules] = useState<AvailabilityRule[] | null>(null);
  const [editDuration, setEditDuration] = useState("");
  const [editClearRules, setEditClearRules] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!canView) return null;

  const links = data ?? [];
  const createDurationMinutes = parseDurationMinutes(createDuration);
  const editDurationMinutes = parseDurationMinutes(editDuration);

  const closeCreate = () => {
    setShowCreate(false);
    setCreateForm({ ...EMPTY_CREATE });
    setCreateRules([]);
    setCreateDuration(String(EMPTY_CREATE.durationMinutes));
  };

  const openCreate = () => {
    setShowCreate(true);
    refreshCalendars();
  };

  const handleCreate = async () => {
    if (createDurationMinutes === null) return;
    setCreating(true);
    try {
      const payload: CreateBookingLinkPayload = { ...createForm, durationMinutes: createDurationMinutes };
      const name = createForm.name?.trim();
      const description = createForm.description?.trim();
      if (name) payload.name = name; else delete payload.name;
      if (description) payload.description = description; else delete payload.description;
      if (createRules.length > 0) payload.availabilityRules = createRules;
      payload.autoAccept = createForm.autoAccept ?? false;
      await createUserBookingLink(username, payload);
      toast({ title: t("users.bookingLinks.created") });
      closeCreate();
      await refresh();
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorCreate"), description: <ErrorDisplayer error={err} /> });
    } finally {
      setCreating(false);
    }
  };

  // Prefill the create dialog from an existing link. The backend assigns a
  // fresh publicId, so this yields an independent copy.
  const handleDuplicate = (link: BookingLink) => {
    setCreateForm({
      calendarUrl: link.calendarUrl,
      durationMinutes: link.durationMinutes,
      active: link.active,
      name: t("users.bookingLinks.copyName", { name: link.name || link.publicId }),
      description: link.description,
      autoAccept: link.autoAccept ?? false,
      color: link.color ?? DEFAULT_COLOR,
    });
    setCreateRules(link.availabilityRules ? link.availabilityRules.map((r) => ({ ...r })) : []);
    setCreateDuration(String(link.durationMinutes));
    openCreate();
  };

  const openEdit = (link: BookingLink) => {
    setEditLink(link);
    setEditForm({
      calendarUrl: link.calendarUrl,
      durationMinutes: link.durationMinutes,
      active: link.active,
      name: link.name,
      description: link.description,
      autoAccept: link.autoAccept ?? false,
      color: link.color ?? DEFAULT_COLOR,
    });
    setEditRules(link.availabilityRules ? [...link.availabilityRules] : []);
    setEditDuration(String(link.durationMinutes));
    setEditClearRules(false);
    refreshCalendars();
  };

  const handleUpdate = async () => {
    if (!editLink || editDurationMinutes === null) return;
    setSaving(true);
    try {
      const payload: UpdateBookingLinkPayload = { ...editForm, durationMinutes: editDurationMinutes };
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
      message: t("users.bookingLinks.deleteConfirm", { name: link.name || link.publicId }),
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
      message: t("users.bookingLinks.resetConfirm", { name: link.name || link.publicId }),
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

  const handleDeleteEvents = async (link: BookingLink) => {
    const confirmed = await confirm({
      header: t("users.bookingLinks.deleteEventsTitle"),
      message: t("users.bookingLinks.deleteEventsConfirm", { name: link.name || link.publicId }),
    });
    if (!confirmed) return;
    try {
      const { taskId } = await deleteUserBookingLinkEvents(username, link.publicId);
      toastTaskCreated(taskId);
    } catch (err) {
      toast({ title: t("users.bookingLinks.errorDeleteEvents"), description: <ErrorDisplayer error={err} /> });
    }
  };

  // Functions, not values: the rules are only validated while their dialog is open
  const isCreateDisabled = () => creating || !createForm.calendarUrl.trim() || !isOfferedCalendar(createForm.calendarUrl, bookableCalendarOptions) || createDurationMinutes === null || !areValidRules(createRules);
  const isEditDisabled = () => saving || !isOfferedCalendar(editForm.calendarUrl ?? "", bookableCalendarOptions) || editDurationMinutes === null || (!editClearRules && !areValidRules(editRules ?? []));

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
          {error && <p className="text-red-500">{t("common.errorPrefix", { message: error })}</p>}

          {canCreate && (
            <div className="mb-2">
              <Button variant="outline" size="sm" onClick={openCreate}>
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
              calendarsListed={calendarsData !== null}
              canEdit={canEdit}
              canDelete={canDelete}
              canReset={canReset}
              canDeleteEvents={canDeleteEvents}
              canDuplicate={canCreate}
              onEdit={openEdit}
              onDelete={handleDelete}
              onReset={handleReset}
              onDeleteEvents={handleDeleteEvents}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(v) => { if (!v) closeCreate(); }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.bookingLinks.create")}</DialogTitle>
          </DialogHeader>
          {/* A form, so that Enter in a field submits like Create; the fields are validated in place, not by the browser */}
          <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!isCreateDisabled()) handleCreate(); }}>
            <div>
              <label htmlFor="create-calendar" className="text-sm font-medium">{t("users.bookingLinks.calendarUrl")} *</label>
              <CalendarSelect
                id="create-calendar"
                value={createForm.calendarUrl}
                onChange={(value) => setCreateForm((f) => ({ ...f, calendarUrl: value }))}
                options={bookableCalendarOptions}
              />
            </div>
            <div>
              <label htmlFor="create-name" className="text-sm font-medium">{t("users.bookingLinks.name")}</label>
              <input
                id="create-name"
                type="text"
                value={createForm.name ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("users.bookingLinks.namePlaceholder")}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="create-description" className="text-sm font-medium">{t("users.bookingLinks.description")}</label>
              <textarea
                id="create-description"
                value={createForm.description ?? ""}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t("users.bookingLinks.descriptionPlaceholder")}
                rows={2}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="create-duration" className="text-sm font-medium">{t("users.bookingLinks.durationMinutes")} *</label>
              <DurationInput id="create-duration" value={createDuration} onChange={setCreateDuration} />
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
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="create-auto-accept"
                checked={createForm.autoAccept ?? false}
                onChange={(e) => setCreateForm((f) => ({ ...f, autoAccept: e.target.checked }))}
                className="w-4 h-4 mt-0.5"
              />
              <label htmlFor="create-auto-accept" className="text-sm">
                <span className="font-medium">{t("users.bookingLinks.autoAccept")}</span>
                <span className="block text-xs text-gray-500">{t("users.bookingLinks.autoAcceptHint")}</span>
              </label>
            </div>
            <div>
              <label htmlFor="create-color" className="text-sm font-medium block mb-1">{t("users.bookingLinks.color")}</label>
              <div className="flex items-center gap-2">
                <input
                  id="create-color"
                  type="color"
                  value={createForm.color ?? DEFAULT_COLOR}
                  onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 p-1 border rounded-md cursor-pointer"
                />
                <span className="text-xs font-mono text-gray-500">{createForm.color ?? DEFAULT_COLOR}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">{t("users.bookingLinks.availabilityRules")}</label>
              <RulesEditor rules={createRules} onChange={setCreateRules} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeCreate}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreateDisabled()}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t("common.create")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editLink} onOpenChange={(v) => { if (!v) setEditLink(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("users.bookingLinks.editTitle")}</DialogTitle>
          </DialogHeader>
          {editLink && (
            <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!isEditDisabled()) handleUpdate(); }}>
              <div>
                <label htmlFor="edit-calendar" className="text-sm font-medium">{t("users.bookingLinks.calendarUrl")} *</label>
                <CalendarSelect
                  id="edit-calendar"
                  value={editForm.calendarUrl ?? ""}
                  onChange={(value) => setEditForm((f) => ({ ...f, calendarUrl: value }))}
                  options={bookableCalendarOptions}
                />
              </div>
              <div>
                <label htmlFor="edit-name" className="text-sm font-medium">{t("users.bookingLinks.name")}</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("users.bookingLinks.namePlaceholder")}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-description" className="text-sm font-medium">{t("users.bookingLinks.description")}</label>
                <textarea
                  id="edit-description"
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("users.bookingLinks.descriptionPlaceholder")}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="edit-duration" className="text-sm font-medium">{t("users.bookingLinks.durationMinutes")} *</label>
                <DurationInput id="edit-duration" value={editDuration} onChange={setEditDuration} />
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
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="edit-auto-accept"
                  checked={editForm.autoAccept ?? false}
                  onChange={(e) => setEditForm((f) => ({ ...f, autoAccept: e.target.checked }))}
                  className="w-4 h-4 mt-0.5"
                />
                <label htmlFor="edit-auto-accept" className="text-sm">
                  <span className="font-medium">{t("users.bookingLinks.autoAccept")}</span>
                  <span className="block text-xs text-gray-500">{t("users.bookingLinks.autoAcceptHint")}</span>
                </label>
              </div>
              <div>
                <label htmlFor="edit-color" className="text-sm font-medium block mb-1">{t("users.bookingLinks.color")}</label>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-color"
                    type="color"
                    value={editForm.color ?? DEFAULT_COLOR}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-9 w-14 p-1 border rounded-md cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-500">{editForm.color ?? DEFAULT_COLOR}</span>
                </div>
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
                <Button type="button" variant="outline" size="sm" onClick={() => setEditLink(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isEditDisabled()}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  {t("common.save")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
