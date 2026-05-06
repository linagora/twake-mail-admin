import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

export const RESOURCE_ICONS = [
  "access-point", "battery", "briefcase", "calculator", "camera", "car",
  "caravan", "cellphone", "coffee", "credit-card", "deskphone", "fax",
  "guitar-acoustic", "home", "kettle", "laptop", "microphone", "motorbike",
  "office", "parking", "phone", "projector", "radio", "remote", "soccer",
  "sofa", "tablet", "train", "umbrella", "video", "wifi",
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function ResourceIconPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-50"
      >
        <img src={`/icons/resources/${value}.svg`} alt={t(`resourceIcons.${value}`)} className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-left">{t(`resourceIcons.${value}`)}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {RESOURCE_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => { onChange(icon); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 transition ${icon === value ? "bg-blue-100 font-medium" : ""}`}
            >
              <img src={`/icons/resources/${icon}.svg`} alt={t(`resourceIcons.${icon}`)} className="w-5 h-5 shrink-0" />
              <span>{t(`resourceIcons.${icon}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
