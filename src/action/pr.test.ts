// src/action/pr.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildPrTitle, buildPrBody, createOrUpdatePr, type PrClient } from './pr.js';
import type { PipelineResult } from '../core/pipeline.js';

function sampleResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    usedKeyCount: 2,
    undefinedKeys: [],
    dynamicUsages: [],
    languages: [{ lang: 'ja', translatedKeys: 2, stampedKeys: 0, failedKeys: [], changed: true, orphanKeys: [] }],
    changedFiles: [],
    ...overrides,
  };
}

describe('buildPrTitle', () => {
  it('lists the target languages', () => {
    expect(buildPrTitle(['ja', 'fr'])).toBe('i18n: update translations (ja, fr)');
  });
});

describe('buildPrBody', () => {
  it('includes a per-language summary table', () => {
    expect(buildPrBody(sampleResult(), 'en')).toContain('| ja | 2 | 0 |');
  });

  it('lists undefined keys as a warning section', () => {
    const body = buildPrBody(
      sampleResult({ undefinedKeys: [{ key: 'typo.key', namespace: 'common', file: 'src/App.tsx', line: 5 }] }),
      'en'
    );
    expect(body).toContain('Undefined keys');
    expect(body).toContain('common:typo.key');
  });

  it('lists failed keys per language', () => {
    const body = buildPrBody(
      sampleResult({
        languages: [
          {
            lang: 'ja',
            translatedKeys: 1,
            stampedKeys: 0,
            failedKeys: ['footer.copyright'],
            changed: true,
            orphanKeys: [],
          },
        ],
      }),
      'en'
    );
    expect(body).toContain('Translation failed');
    expect(body).toContain('ja: footer.copyright');
  });

  it('lists orphan keys per language as a warning section', () => {
    const body = buildPrBody(
      sampleResult({
        languages: [
          {
            lang: 'ja',
            translatedKeys: 0,
            stampedKeys: 0,
            failedKeys: [],
            changed: false,
            orphanKeys: [{ namespace: 'common', key: 'stale.key' }],
          },
        ],
      }),
      'en'
    );
    expect(body).toContain('Orphan keys');
    expect(body).toContain('ja: `common:stale.key`');
  });
});

describe('createOrUpdatePr', () => {
  it('creates a new PR when none exists for the branch', async () => {
    const client: PrClient = {
      listPulls: vi.fn().mockResolvedValue([]),
      createPull: vi.fn().mockResolvedValue({ number: 42 }),
      updatePull: vi.fn(),
    };
    const number = await createOrUpdatePr(client, {
      head: 'i18n-localizer/update-translations',
      base: 'main',
      title: 'title',
      body: 'body',
    });
    expect(number).toBe(42);
    expect(client.createPull).toHaveBeenCalledTimes(1);
    expect(client.updatePull).not.toHaveBeenCalled();
  });

  it('updates the existing PR when one is already open for the branch', async () => {
    const client: PrClient = {
      listPulls: vi.fn().mockResolvedValue([{ number: 7 }]),
      createPull: vi.fn(),
      updatePull: vi.fn().mockResolvedValue(undefined),
    };
    const number = await createOrUpdatePr(client, {
      head: 'i18n-localizer/update-translations',
      base: 'main',
      title: 'title',
      body: 'body',
    });
    expect(number).toBe(7);
    expect(client.createPull).not.toHaveBeenCalled();
    expect(client.updatePull).toHaveBeenCalledWith({ pull_number: 7, title: 'title', body: 'body' });
  });
});
