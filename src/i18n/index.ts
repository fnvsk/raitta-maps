import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { et } from './locales/et';
import { fi } from './locales/fi';
import { ru } from './locales/ru';
import { sv } from './locales/sv';

export const LANGUAGES = [
  { code: 'fi', label: 'Suomi' },
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Svenska' },
  { code: 'ru', label: 'Русский' },
  { code: 'et', label: 'Eesti' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

const isLanguage = (code: string): code is Language => LANGUAGES.some((language) => language.code === code);

export function deviceLanguage(): Language {
  const preferred = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of preferred) {
    const code = tag.slice(0, 2).toLowerCase();
    if (isLanguage(code)) return code;
  }
  return 'en';
}

export const DEFAULT_LANGUAGE: Language = deviceLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fi: { translation: fi },
    sv: { translation: sv },
    ru: { translation: ru },
    et: { translation: et },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
