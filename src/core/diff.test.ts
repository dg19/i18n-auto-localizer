import { describe, it, expect } from 'vitest';
import { computeDiff } from './diff.js';
import type { UsedKey, NamespaceLocaleData, LockfileData } from './types.js';
import { sha256 as sha256Of } from './hash.js';

function usedKey(key: string, namespace: string | null = null): UsedKey {
  return { key, namespace, file: 'src/App.tsx', line: 1 };
}

function localeData(entries: Record<string, Record<string, string>>): NamespaceLocaleData {
  const data: NamespaceLocaleData = {};
  for (const [ns, kv] of Object.entries(entries)) {
    data[ns] = new Map(Object.entries(kv));
  }
  return data;
}

const emptyLockfile: LockfileData = { version: 1, namespaces: {} };

describe('computeDiff — new keys', () => {
  it('marks a key missing from the target as toTranslate', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome' } });
    const target = localeData({ common: {} });
    const result = computeDiff([usedKey('hero.title', 'common')], [], source, target, emptyLockfile);
    expect(result.toTranslate).toEqual([{ namespace: 'common', key: 'hero.title', sourceValue: 'Welcome' }]);
    expect(result.toStamp).toEqual([]);
  });

  it('resolves an unscoped key against source namespaces when there is exactly one match', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome' }, home: { 'hero.subtitle': 'Fast' } });
    const target = localeData({ common: {}, home: {} });
    const result = computeDiff([usedKey('hero.subtitle')], [], source, target, emptyLockfile);
    expect(result.toTranslate).toEqual([{ namespace: 'home', key: 'hero.subtitle', sourceValue: 'Fast' }]);
  });
});

describe('computeDiff — undefined keys', () => {
  it('reports a key used in code but absent from every source namespace', () => {
    const source = localeData({ common: {} });
    const target = localeData({ common: {} });
    const key = usedKey('missing.key', 'common');
    const result = computeDiff([key], [], source, target, emptyLockfile);
    expect(result.toTranslate).toEqual([]);
    expect(result.undefinedKeys).toEqual([key]);
  });
});

describe('computeDiff — existing-translation protection', () => {
  it('does not translate a key that has a target value but no lockfile record (first run, pre-existing manual translation)', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome' } });
    const target = localeData({ common: { 'hero.title': '既存の手動翻訳' } });
    const result = computeDiff([usedKey('hero.title', 'common')], [], source, target, emptyLockfile);
    expect(result.toTranslate).toEqual([]);
  });

  it('stamps (records, without translating) a key that has a target value but no lockfile record', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome' } });
    const target = localeData({ common: { 'hero.title': '既存の手動翻訳' } });
    const result = computeDiff([usedKey('hero.title', 'common')], [], source, target, emptyLockfile);
    expect(result.toStamp).toEqual([{ namespace: 'common', key: 'hero.title', sourceValue: 'Welcome' }]);
  });

  it('leaves a key untouched when the lockfile hash matches the current source value', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome' } });
    const target = localeData({ common: { 'hero.title': 'ようこそ' } });
    const lockfile: LockfileData = {
      version: 1,
      namespaces: { common: { 'hero.title': sha256Of('Welcome') } },
    };
    const result = computeDiff([usedKey('hero.title', 'common')], [], source, target, lockfile);
    expect(result.toTranslate).toEqual([]);
    expect(result.toStamp).toEqual([]);
  });

  it('retranslates a key when the lockfile hash no longer matches the source value', () => {
    const source = localeData({ common: { 'hero.title': 'Welcome back' } });
    const target = localeData({ common: { 'hero.title': 'ようこそ' } });
    const lockfile: LockfileData = {
      version: 1,
      namespaces: { common: { 'hero.title': sha256Of('Welcome') } },
    };
    const result = computeDiff([usedKey('hero.title', 'common')], [], source, target, lockfile);
    expect(result.toTranslate).toEqual([{ namespace: 'common', key: 'hero.title', sourceValue: 'Welcome back' }]);
  });
});

describe('computeDiff — orphan keys', () => {
  it('reports a target key that is no longer used in code, without removing it', () => {
    const source = localeData({ common: {} });
    const target = localeData({ common: { 'stale.key': 'old value' } });
    const result = computeDiff([], [], source, target, emptyLockfile);
    expect(result.orphanKeys).toEqual([{ namespace: 'common', key: 'stale.key' }]);
  });
});
