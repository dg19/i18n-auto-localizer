import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readLockfile, writeLockfile, getLockHash, setLockHash } from './lockfile.js';

describe('lockfile', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns an empty v1 lockfile when no file exists yet', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-lock-'));
    const data = await readLockfile(tmpDir);
    expect(data).toEqual({ version: 1, namespaces: {} });
  });

  it('writes and reads back a lockfile', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'i18n-lock-'));
    const data = { version: 1 as const, namespaces: { common: { 'hero.title': 'sha256:abc' } } };
    await writeLockfile(tmpDir, data);
    const reloaded = await readLockfile(tmpDir);
    expect(reloaded).toEqual(data);
  });

  it('getLockHash returns undefined for an untracked key', () => {
    const data = { version: 1 as const, namespaces: {} };
    expect(getLockHash(data, 'common', 'hero.title')).toBeUndefined();
  });

  it('setLockHash then getLockHash round-trips', () => {
    const data = { version: 1 as const, namespaces: {} };
    setLockHash(data, 'common', 'hero.title', 'sha256:abc');
    expect(getLockHash(data, 'common', 'hero.title')).toBe('sha256:abc');
  });
});
