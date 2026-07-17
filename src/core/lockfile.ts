import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LockfileData } from './types.js';

const LOCKFILE_NAME = '.i18n-localizer-lock.json';

export async function readLockfile(repoRoot: string): Promise<LockfileData> {
  try {
    const raw = await readFile(path.join(repoRoot, LOCKFILE_NAME), 'utf8');
    return JSON.parse(raw) as LockfileData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, namespaces: {} };
    }
    throw err;
  }
}

export async function writeLockfile(repoRoot: string, data: LockfileData): Promise<void> {
  await writeFile(path.join(repoRoot, LOCKFILE_NAME), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function getLockHash(
  lockfile: LockfileData,
  namespace: string,
  key: string
): string | undefined {
  return lockfile.namespaces[namespace]?.[key];
}

export function setLockHash(
  lockfile: LockfileData,
  namespace: string,
  key: string,
  hash: string
): void {
  if (!lockfile.namespaces[namespace]) {
    lockfile.namespaces[namespace] = {};
  }
  lockfile.namespaces[namespace][key] = hash;
}
