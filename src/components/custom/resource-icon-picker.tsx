import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { OWNS_ESCAPE } from "@/components/ui/dialog";

// The icons the calendar side service accepts (ResourceIcons.SUPPORTED), each with its image
export const RESOURCE_ICONS = [
  "access-point", "battery", "briefcase", "calculator", "calendar-month", "camera", "car",
  "caravan", "cellphone", "coffee", "credit-card", "description", "deskphone", "fax",
  "guitar-acoustic", "home", "kettle", "laptop", "layers", "meeting-room", "microphone",
  "motorbike", "office", "parking", "people-alt", "phone", "phone-iphone", "projector",
  "radio", "remote", "soccer", "sofa", "tablet", "train", "tv", "umbrella", "video",
  "video-camera-back", "view-comfy-alt", "wifi",
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  // The id of the visible label: the trigger is then named "<label> <current icon>".
  labelId?: string;
}

// The icons are decorative (alt=""): each one is named by the text next to it.
export default function ResourceIconPicker({ value, onChange, labelId }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();
  const valueId = `${idPrefix}-value`;
  const listId = `${idPrefix}-list`;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      {...{ [OWNS_ESCAPE]: open ? "true" : undefined }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          // Close the list only, not the dialog holding the picker.
          e.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
        className="w-full flex items-center gap-2 px-3 py-2 border rounded-md text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 hover:bg-gray-50"
      >
        {/* An icon the console does not know (set elsewhere) is kept, under its key */}
        {RESOURCE_ICONS.includes(value) && <img src={`/icons/resources/${value}.svg`} alt="" className="w-5 h-5 shrink-0" />}
        <span id={valueId} className="flex-1 text-left">{t(`resourceIcons.${value}`, { defaultValue: value })}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div id={listId} role="group" className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {RESOURCE_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => { onChange(icon); setOpen(false); triggerRef.current?.focus(); }}
              aria-pressed={icon === value}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition ${icon === value ? "bg-blue-100 font-medium" : ""}`}
            >
              <img src={`/icons/resources/${icon}.svg`} alt="" className="w-5 h-5 shrink-0" />
              <span>{t(`resourceIcons.${icon}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
