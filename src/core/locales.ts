import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocaleValueMap, NamespaceLocaleData } from './types.js';

export function flattenJson(obj: Record<string, unknown>, prefix = ''): LocaleValueMap {
  const map: LocaleValueMap = new Map();
  for (const [key, value] of Object.entries(obj)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flattenJson(value as Record<string, unknown>, dotPath)) {
        map.set(k, v);
      }
    } else {
      map.set(dotPath, String(value));
    }
  }
  return map;
}

export function unflattenToJson(map: LocaleValueMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [dotPath, value] of map) {
    const segments = dotPath.split('.');
    let cursor = result;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = value;
  }
  return result;
}

export async function loadNamespaceLocales(
  localesDir: string,
  lang: string
): Promise<NamespaceLocaleData> {
  const langDir = path.join(localesDir, lang);
  const files = await fg('*.json', { cwd: langDir });
  const data: NamespaceLocaleData = {};

  for (const file of files) {
    const namespace = path.basename(file, '.json');
    const raw = await readFile(path.join(langDir, file), 'utf8');
    data[namespace] = flattenJson(JSON.parse(raw));
  }

  return data;
}
