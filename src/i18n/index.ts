import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ru from "./locales/ru.json";
import vi from "./locales/vi.json";
import mn from "./locales/mn.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

export const supportedLanguages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ru", label: "Русский" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "mn", label: "Монгол" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ru: { translation: ru },
      vi: { translation: vi },
      mn: { translation: mn },
      es: { translation: es },
      de: { translation: de },
      it: { translation: it },
    },
    fallbackLng: "en",
    supportedLngs: supportedLanguages.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
