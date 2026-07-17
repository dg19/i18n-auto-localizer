import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { flattenJson, unflattenToJson, loadNamespaceLocales } from './locales.js';

describe('flattenJson', () => {
  it('flattens nested objects into dot-path keys', () => {
    const map = flattenJson({ hero: { title: 'Welcome' }, footer: { copyright: 'All rights reserved' } });
    expect(map.get('hero.title')).toBe('Welcome');
    expect(map.get('footer.copyright')).toBe('All rights reserved');
    expect(map.size).toBe(2);
  });
});

describe('unflattenToJson', () => {
  it('rebuilds a nested object from dot-path keys', () => {
    const map = new Map([['hero.title', 'Welcome'], ['hero.subtitle', 'Build faster']]);
    expect(unflattenToJson(map)).toEqual({ hero: { title: 'Welcome', subtitle: 'Build faster' } });
  });

  it('round-trips through flattenJson', () => {
    const original = { a: { b: { c: '1' } }, d: '2' };
    expect(unflattenToJson(flattenJson(original))).toEqual(original);
  });
});

describe('loadNamespaceLocales', () => {
  const localesDir = path.resolve(__dirname, '../../fixtures/locales');

  it('loads every .json file in the language directory as a namespace', async () => {
    const data = await loadNamespaceLocales(localesDir, 'en');
    expect(Object.keys(data).sort()).toEqual(['common', 'home']);
    expect(data.common.get('hero.title')).toBe('Welcome');
    expect(data.home.get('hero.subtitle')).toBe('Build faster');
  });

  it('returns an empty object for a language directory that does not exist', async () => {
    const data = await loadNamespaceLocales(localesDir, 'de');
    expect(data).toEqual({});
  });
});
