import { useState } from "react";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";

export interface MailFilters {
  sender: string;
  recipient: string;
  updatedBefore: string;
  updatedAfter: string;
  remoteAddress: string;
  remoteHost: string;
}

const EMPTY_FILTERS: MailFilters = {
  sender: "",
  recipient: "",
  updatedBefore: "",
  updatedAfter: "",
  remoteAddress: "",
  remoteHost: "",
};

interface Props {
  filters: MailFilters;
  onApply: (filters: MailFilters) => void;
}

const FIELDS: { key: keyof MailFilters; label: string; placeholder: string }[] = [
  { key: "sender", label: "Sender", placeholder: "alice@domain.org" },
  { key: "recipient", label: "Recipient", placeholder: "bob@domain.org" },
  { key: "remoteAddress", label: "Remote Address", placeholder: "192.168.1.10" },
  { key: "remoteHost", label: "Remote Host", placeholder: "smtp.external.org" },
  { key: "updatedBefore", label: "Updated Before", placeholder: "1d, 2h, 30m" },
  { key: "updatedAfter", label: "Updated After", placeholder: "7d, 2h, 30m" },
];

export default function MailFiltersPanel({ filters, onApply }: Props) {
  const activeCount = Object.values(filters).filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);
  const [draft, setDraft] = useState<MailFilters>(filters);

  const set =
    (key: keyof MailFilters) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  const handleReset = () => {
    setDraft(EMPTY_FILTERS);
    onApply(EMPTY_FILTERS);
  };

  return (
    <div className="border rounded-lg mb-4 bg-white">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition rounded-lg"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              {activeCount} active
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <input
                  type="text"
                  value={draft[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onApply(draft);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
