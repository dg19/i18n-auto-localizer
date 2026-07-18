// src/action/inputs.test.ts
import { describe, it, expect } from 'vitest';
import { parseInputs } from './inputs.js';

function fakeGetInput(values: Record<string, string>) {
  return (name: string) => values[name] ?? '';
}

describe('parseInputs', () => {
  it('parses required inputs and splits comma-separated lists', () => {
    const result = parseInputs(
      fakeGetInput({
        'source-lang': 'en',
        'target-langs': 'ja, fr , de',
        'locales-dir': './public/locales',
        'api-key': 'sk-or-abc',
        'github-token': 'ghp-abc',
      })
    );
    expect(result).toEqual({
      sourceLang: 'en',
      targetLangs: ['ja', 'fr', 'de'],
      localesDir: './public/locales',
      srcGlobs: ['src/**/*.{js,jsx,ts,tsx,vue}'],
      model: 'anthropic/claude-sonnet-4.5',
      apiKey: 'sk-or-abc',
      githubToken: 'ghp-abc',
    });
  });

  it('honors explicit src and model overrides', () => {
    const result = parseInputs(
      fakeGetInput({
        'source-lang': 'en',
        'target-langs': 'ja',
        'locales-dir': './locales',
        src: 'app/**/*.tsx, packages/**/*.ts',
        model: 'openai/gpt-4o',
        'api-key': 'key',
        'github-token': 'token',
      })
    );
    expect(result.srcGlobs).toEqual(['app/**/*.tsx', 'packages/**/*.ts']);
    expect(result.model).toBe('openai/gpt-4o');
  });
});
