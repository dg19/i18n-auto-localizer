import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unflattenToJson } from './locales.js';
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

export async function writeLocaleFile(
  localesDir: string,
  lang: string,
  namespace: string,
  valueMap: LocaleValueMap
): Promise<void> {
  const filePath = path.join(localesDir, lang, `${namespace}.json`);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(unflattenToJson(valueMap), null, 2) + '\n', 'utf8');
}
