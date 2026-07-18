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

  it('fails with a clear error when the API key is missing and --dry-run is not set', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-cli-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales', 'en'), { recursive: true });

    delete process.env.OPENROUTER_API_KEY;
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await buildProgram().parseAsync([
      'node', 'cli', 'run',
      '--source-lang', 'en',
      '--target-langs', 'ja',
      '--locales-dir', path.join(root, 'locales'),
    ]);

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('OPENROUTER_API_KEY'));
    expect(process.exitCode).toBe(1);

    process.exitCode = 0;
    cwdSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
