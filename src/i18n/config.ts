import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";
import id from "./locales/id";
import vi from "./locales/vi";
import zh from "./locales/zh";
import de from "./locales/de";

export const SUPPORTED_LANGUAGES = ["en", "fr", "es", "id", "vi", "zh", "de"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      id: { translation: id },
      vi: { translation: vi },
      zh: { translation: zh },
      de: { translation: de },
    },
    fallbackLng: "en",
    // Map browser language codes to our supported languages
    supportedLngs: SUPPORTED_LANGUAGES,
    // Accept zh-CN, zh-TW, zh-HK → zh
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "cr_lang",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
