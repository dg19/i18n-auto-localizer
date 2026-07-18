import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPipeline } from './pipeline.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function chatCompletionBody(content: string) {
  return { choices: [{ message: { content } }] };
}

async function setupProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'i18n-pipeline-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'locales', 'en'), { recursive: true });
  await writeFile(
    path.join(root, 'src', 'App.tsx'),
    `t('hero.title'); t('footer.copyright');`,
    'utf8'
  );
  await writeFile(
    path.join(root, 'locales', 'en', 'common.json'),
    JSON.stringify({ hero: { title: 'Welcome' }, footer: { copyright: 'All rights reserved' } }, null, 2),
    'utf8'
  );
  return root;
}

describe('runPipeline — full run', () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('translates missing keys for a brand-new target language and writes files', async () => {
    root = await setupProject();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          chatCompletionBody(
            JSON.stringify({ 'hero.title': 'ようこそ', 'footer.copyright': '全著作権所有' })
          )
        )
      );

    const result = await runPipeline({
      sourceLang: 'en',
      targetLangs: ['ja'],
      localesDir: path.join(root, 'locales'),
      srcGlobs: ['src/**/*.tsx'],
      cwd: root,
      model: 'test/model',
      apiKey: 'key',
      dryRun: false,
      fetchImpl,
    });

    expect(result.languages).toEqual([
      { lang: 'ja', translatedKeys: 2, stampedKeys: 0, failedKeys: [], changed: true, orphanKeys: [] },
    ]);

    const written = JSON.parse(await readFile(path.join(root, 'locales', 'ja', 'common.json'), 'utf8'));
    expect(written).toEqual({ hero: { title: 'ようこそ' }, footer: { copyright: '全著作権所有' } });

    const lockfile = JSON.parse(await readFile(path.join(root, '.i18n-localizer-lock.json'), 'utf8'));
    expect(Object.keys(lockfile.namespaces.common)).toEqual(['hero.title', 'footer.copyright']);
  });

  it('protects a pre-existing manual translation on the very first run', async () => {
    root = await setupProject();
    await mkdir(path.join(root, 'locales', 'ja'), { recursive: true });
    await writeFile(
      path.join(root, 'locales', 'ja', 'common.json'),
      JSON.stringify({ hero: { title: '既存の手動翻訳' } }, null, 2),
      'utf8'
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(chatCompletionBody(JSON.stringify({ 'footer.copyright': '全著作権所有' }))));

    const result = await runPipeline({
      sourceLang: 'en',
      targetLangs: ['ja'],
      localesDir: path.join(root, 'locales'),
      srcGlobs: ['src/**/*.tsx'],
      cwd: root,
      model: 'test/model',
      apiKey: 'key',
      dryRun: false,
      fetchImpl,
    });

    expect(result.languages[0]).toEqual({
      lang: 'ja',
      translatedKeys: 1,
      stampedKeys: 1,
      failedKeys: [],
      changed: true,
      orphanKeys: [],
    });

    const written = JSON.parse(await readFile(path.join(root, 'locales', 'ja', 'common.json'), 'utf8'));
    expect(written.hero.title).toBe('既存の手動翻訳');
    expect(written.footer.copyright).toBe('全著作権所有');

    const lockfile = JSON.parse(await readFile(path.join(root, '.i18n-localizer-lock.json'), 'utf8'));
    expect(lockfile.namespaces.common['hero.title']).toEqual(expect.any(String));
    expect(lockfile.namespaces.common['hero.title'].length).toBeGreaterThan(0);
    expect(lockfile.namespaces.common['footer.copyright']).toEqual(expect.any(String));
    expect(lockfile.namespaces.common['footer.copyright'].length).toBeGreaterThan(0);
  });

  it('does not call the translator and does not write files in dry-run mode', async () => {
    root = await setupProject();
    const fetchImpl = vi.fn();

    const result = await runPipeline({
      sourceLang: 'en',
      targetLangs: ['ja'],
      localesDir: path.join(root, 'locales'),
      srcGlobs: ['src/**/*.tsx'],
      cwd: root,
      model: 'test/model',
      apiKey: 'key',
      dryRun: true,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.languages).toEqual([
      { lang: 'ja', translatedKeys: 2, stampedKeys: 0, failedKeys: [], changed: true, orphanKeys: [] },
    ]);
    await expect(readFile(path.join(root, 'locales', 'ja', 'common.json'), 'utf8')).rejects.toThrow();
  });

  it('surfaces orphan keys present in the target locale but no longer used in code', async () => {
    root = await setupProject();
    await mkdir(path.join(root, 'locales', 'ja'), { recursive: true });
    await writeFile(
      path.join(root, 'locales', 'ja', 'common.json'),
      JSON.stringify(
        { hero: { title: 'ようこそ' }, footer: { copyright: '全著作権所有' }, stale: { key: '古い値' } },
        null,
        2
      ),
      'utf8'
    );
    const fetchImpl = vi.fn();

    const result = await runPipeline({
      sourceLang: 'en',
      targetLangs: ['ja'],
      localesDir: path.join(root, 'locales'),
      srcGlobs: ['src/**/*.tsx'],
      cwd: root,
      model: 'test/model',
      apiKey: 'key',
      dryRun: true,
      fetchImpl,
    });

    expect(result.languages[0].orphanKeys).toEqual([{ namespace: 'common', key: 'stale.key' }]);
  });

  it('writes a brand-new target language in the flat single-file format when the source uses it', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'i18n-pipeline-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'locales'), { recursive: true });
    await writeFile(path.join(root, 'src', 'App.tsx'), `t('sidebar.title');`, 'utf8');
    await writeFile(
      path.join(root, 'locales', 'ja.json'),
      JSON.stringify({ sidebar: { title: 'ショップ管理' } }, null, 2),
      'utf8'
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(chatCompletionBody(JSON.stringify({ 'sidebar.title': 'Shop Admin' }))));

    const result = await runPipeline({
      sourceLang: 'ja',
      targetLangs: ['en'],
      localesDir: path.join(root, 'locales'),
      srcGlobs: ['src/**/*.tsx'],
      cwd: root,
      model: 'test/model',
      apiKey: 'key',
      dryRun: false,
      fetchImpl,
    });

    expect(result.languages[0].translatedKeys).toBe(1);

    const written = JSON.parse(await readFile(path.join(root, 'locales', 'en.json'), 'utf8'));
    expect(written).toEqual({ sidebar: { title: 'Shop Admin' } });

    await expect(
      readFile(path.join(root, 'locales', 'en', 'translation.json'), 'utf8')
    ).rejects.toThrow();
  });
});
