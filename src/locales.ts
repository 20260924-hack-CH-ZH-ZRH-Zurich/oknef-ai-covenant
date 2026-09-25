const adapters = {
  en: { path: "/v1", suffix: "" },
  de: { path: "/v1/de", suffix: "-de" },
  es: { path: "/v1/es", suffix: "-es" },
  fr: { path: "/v1/fr", suffix: "-fr" },
} as const;

export type Locale = keyof typeof adapters;
export const supportedLocales = Object.keys(adapters) as Locale[];

export function localeAdapter(locale: Locale) {
  if (!Object.hasOwn(adapters, locale)) throw new Error("Unsupported locale");
  return adapters[locale];
}
