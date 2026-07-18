// bin/cli.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildProgram } from './cli.js';

describe('cli run --dry-run', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('prints a diff summary without requiring an API key', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-cli-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'en'), { recursive: true });
    await writeFile(path.join(root, 'src', 'App.tsx'), `t('hero.title');`, 'utf8');
    await writeFile(
      path.join(root, 'locales', 'en', 'common.json'),
      JSON.stringify({ hero: { title: 'Welcome' } }),
      'utf8'
    );

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'run',
      '--source-lang', 'en',
      '--target-langs', 'ja',
      '--locales-dir', path.join(root, 'locales'),
      '--src', 'src/**/*.tsx',
      '--dry-run',
    ]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('translated=1'));

    cwdSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('uses the default --src glob (containing commas in brace expansion) when --src is omitted', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-cli-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'en'), { recursive: true });
    // .tsx is one of the extensions in the default brace-expansion glob
    // 'src/**/*.{js,jsx,ts,tsx,vue}' — this file must be found WITHOUT --src.
    await writeFile(path.join(root, 'src', 'App.tsx'), `t('hero.title');`, 'utf8');
    await writeFile(
      path.join(root, 'locales', 'en', 'common.json'),
      JSON.stringify({ hero: { title: 'Welcome' } }),
      'utf8'
    );

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'run',
      '--source-lang', 'en',
      '--target-langs', 'ja',
      '--locales-dir', path.join(root, 'locales'),
      '--dry-run',
      // note: --src intentionally omitted to exercise the default glob
    ]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('translated=1'));

    cwdSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('fails with a clear error when the API key is missing and --dry-run is not set', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-cli-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'en'), { recursive: true });

    const originalApiKey = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await buildProgram().parseAsync([
        'node', 'cli', 'run',
        '--source-lang', 'en',
        '--target-langs', 'ja',
        '--locales-dir', path.join(root, 'locales'),
      ]);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('OPENROUTER_API_KEY'));
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('prints orphan keys present in the target locale but no longer used in code', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-cli-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'en'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'ja'), { recursive: true });
    await writeFile(path.join(root, 'src', 'App.tsx'), `t('hero.title');`, 'utf8');
    await writeFile(
      path.join(root, 'locales', 'en', 'common.json'),
      JSON.stringify({ hero: { title: 'Welcome' } }),
      'utf8'
    );
    await writeFile(
      path.join(root, 'locales', 'ja', 'common.json'),
      JSON.stringify({ hero: { title: 'ようこそ' }, stale: { key: '古い値' } }),
      'utf8'
    );

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'run',
      '--source-lang', 'en',
      '--target-langs', 'ja',
      '--locales-dir', path.join(root, 'locales'),
      '--src', 'src/**/*.tsx',
      '--dry-run',
    ]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Orphan keys'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('common:stale.key'));

    cwdSpy.mockRestore();
    logSpy.mockRestore();
  });
});
