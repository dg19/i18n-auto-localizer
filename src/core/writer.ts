import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unflattenToJson, type LocaleFormat } from './locales.js';
import type { LocaleValueMap } from './types.js';

export function mergeTranslations(
  existing: LocaleValueMap,
  translations: Map<string, string>
): LocaleValueMap {
  const merged = new Map(existing);
  for (const [key, value] of translations) {
    merged.set(key, value);
  }
  return merged;
}

export function localeFilePath(
  localesDir: string,
  lang: string,
  namespace: string,
  format: LocaleFormat = 'directory'
): string {
  return format === 'flat'
    ? path.join(localesDir, `${lang}.json`)
    : path.join(localesDir, lang, `${namespace}.json`);
}

export async function writeLocaleFile(
  localesDir: string,
  lang: string,
  namespace: string,
  valueMap: LocaleValueMap,
  format: LocaleFormat = 'directory'
): Promise<void> {
  const filePath = localeFilePath(localesDir, lang, namespace, format);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(unflattenToJson(valueMap), null, 2) + '\n', 'utf8');
}
