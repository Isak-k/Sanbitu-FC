import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from '../locales/en.json';
import om from '../locales/om.json';
import am from '../locales/am.json';

const resources = {
  en: {
    translation: en
  },
  om: {
    translation: om
  },
  am: {
    translation: am
  }
};

// Safe detection configuration for SSR
const detectionOptions = typeof window !== 'undefined' 
  ? {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    }
  : {
      order: ['navigator', 'htmlTag'],
      caches: [],
    };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    detection: detectionOptions,

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;