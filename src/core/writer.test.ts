import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mergeTranslations, writeLocaleFile } from './writer.js';

describe('mergeTranslations', () => {
  it('keeps existing keys untouched and adds new ones', () => {
    const existing = new Map([['hero.title', '既存の訳']]);
    const translations = new Map([['footer.copyright', '全著作権所有']]);
    const merged = mergeTranslations(existing, translations);
    expect(merged.get('hero.title')).toBe('既存の訳');
    expect(merged.get('footer.copyright')).toBe('全著作権所有');
  });

  it('overwrites a key only when it appears in translations', () => {
    const existing = new Map([['hero.title', '古い訳']]);
    const translations = new Map([['hero.title', '新しい訳']]);
    const merged = mergeTranslations(existing, translations);
    expect(merged.get('hero.title')).toBe('新しい訳');
  });

  it('does not mutate the existing map', () => {
    const existing = new Map([['hero.title', '既存の訳']]);
    mergeTranslations(existing, new Map([['hero.title', '新しい訳']]));
    expect(existing.get('hero.title')).toBe('既存の訳');
  });
});

describe('writeLocaleFile', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a nested JSON file at {localesDir}/{lang}/{namespace}.json', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-writer-'));
    const valueMap = new Map([
      ['hero.title', 'ようこそ'],
      ['footer.copyright', '全著作権所有'],
    ]);
    await writeLocaleFile(tmpDir, 'ja', 'common', valueMap);

    const raw = await readFile(path.join(tmpDir, 'ja', 'common.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ hero: { title: 'ようこそ' }, footer: { copyright: '全著作権所有' } });
  });

  it('creates the language directory when it does not exist yet (new language)', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-writer-'));
    await writeLocaleFile(tmpDir, 'fr', 'common', new Map([['hero.title', 'Bienvenue']]));
    const raw = await readFile(path.join(tmpDir, 'fr', 'common.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ hero: { title: 'Bienvenue' } });
  });

  it('writes to {localesDir}/{lang}.json when format is "flat"', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-writer-'));
    await writeLocaleFile(tmpDir, 'en', 'translation', new Map([['sidebar.title', 'Shop Admin']]), 'flat');

    const raw = await readFile(path.join(tmpDir, 'en.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual({ sidebar: { title: 'Shop Admin' } });
  });
});
