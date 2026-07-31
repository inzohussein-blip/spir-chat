import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

/** Resolve the active locale from the cookie, falling back to the default. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server-side dictionary for the active locale (for server components). */
export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
