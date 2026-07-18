import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { flattenJson, unflattenToJson, loadNamespaceLocales, detectLocaleFormat } from './locales.js';

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

describe('loadNamespaceLocales — flat single-file-per-language format', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('loads {locales-dir}/{lang}.json as a single "translation" namespace when no language directory exists', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-flat-locales-'));
    await writeFile(
      path.join(tmpDir, 'ja.json'),
      JSON.stringify({ app: { sampleUserName: '佐藤' }, sidebar: { title: 'ショップ管理' } }),
      'utf8'
    );

    const data = await loadNamespaceLocales(tmpDir, 'ja');

    expect(Object.keys(data)).toEqual(['translation']);
    expect(data.translation.get('app.sampleUserName')).toBe('佐藤');
    expect(data.translation.get('sidebar.title')).toBe('ショップ管理');
  });

  it('prefers the directory form over the flat-file form when both exist for the same language', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-flat-locales-'));
    await mkdir(path.join(tmpDir, 'ja'), { recursive: true });
    await writeFile(path.join(tmpDir, 'ja', 'common.json'), JSON.stringify({ hero: { title: 'ようこそ' } }), 'utf8');
    await writeFile(path.join(tmpDir, 'ja.json'), JSON.stringify({ hero: { title: 'この値は使われない' } }), 'utf8');

    const data = await loadNamespaceLocales(tmpDir, 'ja');

    expect(Object.keys(data)).toEqual(['common']);
    expect(data.common.get('hero.title')).toBe('ようこそ');
  });
});

describe('detectLocaleFormat', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns "directory" when {locales-dir}/{lang}/ exists', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-format-'));
    await mkdir(path.join(tmpDir, 'en'), { recursive: true });
    await writeFile(path.join(tmpDir, 'en', 'common.json'), '{}', 'utf8');

    expect(await detectLocaleFormat(tmpDir, 'en')).toBe('directory');
  });

  it('returns "flat" when {locales-dir}/{lang}.json exists and no directory does', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-format-'));
    await writeFile(path.join(tmpDir, 'ja.json'), '{}', 'utf8');

    expect(await detectLocaleFormat(tmpDir, 'ja')).toBe('flat');
  });

  it('returns "none" when neither exists', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-format-'));

    expect(await detectLocaleFormat(tmpDir, 'de')).toBe('none');
  });
});
