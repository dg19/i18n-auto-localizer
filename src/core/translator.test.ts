// src/core/translator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { translateBatch } from './translator.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function chatCompletionBody(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('translateBatch — happy path', () => {
  it('translates all entries in a single request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(chatCompletionBody(JSON.stringify({ 'hero.title': 'ようこそ' }))));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl },
      'Japanese',
      [{ key: 'hero.title', sourceValue: 'Welcome' }]
    );

    expect(result.translations.get('hero.title')).toBe('ようこそ');
    expect(result.failedKeys).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('strips markdown code fences from the model response', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(chatCompletionBody('```json\n{"hero.title": "ようこそ"}\n```')));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl },
      'Japanese',
      [{ key: 'hero.title', sourceValue: 'Welcome' }]
    );

    expect(result.translations.get('hero.title')).toBe('ようこそ');
  });

  it('returns an empty result without calling fetch when there are no entries', async () => {
    const fetchImpl = vi.fn();
    const result = await translateBatch({ apiKey: 'key', model: 'test/model', fetchImpl }, 'Japanese', []);
    expect(result).toEqual({ translations: new Map(), failedKeys: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('translateBatch — placeholder mismatch retry', () => {
  it('retries a single key when its placeholders do not match, and succeeds on retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(chatCompletionBody(JSON.stringify({ greet: 'こんにちは' }))))
      .mockResolvedValueOnce(
        jsonResponse(chatCompletionBody(JSON.stringify({ greet: 'こんにちは {{name}}' })))
      );

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl },
      'Japanese',
      [{ key: 'greet', sourceValue: 'Hello {{name}}' }]
    );

    expect(result.translations.get('greet')).toBe('こんにちは {{name}}');
    expect(result.failedKeys).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('marks the key failed when the retry also mismatches', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(chatCompletionBody(JSON.stringify({ greet: 'こんにちは' }))));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl },
      'Japanese',
      [{ key: 'greet', sourceValue: 'Hello {{name}}' }]
    );

    expect(result.translations.has('greet')).toBe(false);
    expect(result.failedKeys).toEqual(['greet']);
  });
});

describe('translateBatch — HTTP retry and batch failure', () => {
  it('retries on a 429 and succeeds once the rate limit clears', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429))
      .mockResolvedValueOnce(jsonResponse(chatCompletionBody(JSON.stringify({ 'hero.title': 'ようこそ' }))));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl, retryDelaysMs: [0, 0] },
      'Japanese',
      [{ key: 'hero.title', sourceValue: 'Welcome' }]
    );

    expect(result.translations.get('hero.title')).toBe('ようこそ');
  });

  it('marks every key in the batch failed when all retries are exhausted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl, retryDelaysMs: [0, 0] },
      'Japanese',
      [
        { key: 'hero.title', sourceValue: 'Welcome' },
        { key: 'footer.copyright', sourceValue: 'All rights reserved' },
      ]
    );

    expect(result.translations.size).toBe(0);
    expect(result.failedKeys.sort()).toEqual(['footer.copyright', 'hero.title']);
  });

  it('does not retry on a non-retryable 400 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad request' }, 400));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl, retryDelaysMs: [0, 0] },
      'Japanese',
      [{ key: 'hero.title', sourceValue: 'Welcome' }]
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.failedKeys).toEqual(['hero.title']);
  });

  it('resolves with every key failed (does not throw) when the model responds with JSON null', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(chatCompletionBody('null')));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl, retryDelaysMs: [0, 0] },
      'Japanese',
      [
        { key: 'hero.title', sourceValue: 'Welcome' },
        { key: 'footer.copyright', sourceValue: 'All rights reserved' },
      ]
    );

    expect(result.translations.size).toBe(0);
    expect(result.failedKeys.sort()).toEqual(['footer.copyright', 'hero.title']);
  });

  it('resolves with every key failed (does not throw) when the model responds with a JSON array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(chatCompletionBody('[]')));

    const result = await translateBatch(
      { apiKey: 'key', model: 'test/model', fetchImpl, retryDelaysMs: [0, 0] },
      'Japanese',
      [{ key: 'hero.title', sourceValue: 'Welcome' }]
    );

    expect(result.translations.size).toBe(0);
    expect(result.failedKeys).toEqual(['hero.title']);
  });
});
