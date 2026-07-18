// src/action/inputs.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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

  // Regression test for a Critical review finding on Task 13 (GitHub Action):
  //
  // action.yml used to declare `default: 'src/**/*.{js,jsx,ts,tsx,vue}'` on the
  // `src` input. GitHub Actions auto-populates INPUT_SRC from that declared
  // default BEFORE the JS entrypoint runs, so `@actions/core.getInput('src')`
  // would return the non-empty default-glob string (not '') for any workflow
  // that omits `src:` in its `with:` block -- including this project's own
  // README example. That made `srcRaw` truthy in parseInputs, sending the
  // default glob through `.split(',')` and shredding it on the commas inside
  // `{js,jsx,ts,tsx,vue}`, producing a garbage list of globs instead of the
  // intended single pattern -- silently scanning zero files by default.
  //
  // The old hand-written fakeGetInput stub above (returns '' for any
  // unspecified key) does NOT reproduce this, because it doesn't simulate
  // action.yml's default-injection behavior. These two tests close that gap.
  it('does not declare a competing `default:` for `src` in action.yml', () => {
    // parseInputs' own default-glob fallback only fires when getInput('src')
    // returns '', which only happens at runtime if action.yml leaves `src`
    // without a declared default (see the comment above the guard in
    // inputs.ts). This test parses action.yml directly so that re-adding a
    // default there fails CI even though inputs.ts itself is untouched.
    const actionYmlPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../action.yml'
    );
    const actionYml = readFileSync(actionYmlPath, 'utf8');

    // Isolate the `src:` input block: from the `  src:` line up to (but not
    // including) the next top-level (2-space-indented) input key.
    const srcBlockMatch = actionYml.match(/\n {2}src:\n([\s\S]*?)(?=\n {2}\S)/);
    expect(srcBlockMatch, 'expected to find a `src:` input block in action.yml').not.toBeNull();
    const srcBlock = srcBlockMatch![1];

    expect(srcBlock).not.toMatch(/^\s*default:/m);
  });

  it('falls back to the single default glob when src is genuinely unset (real getInput behavior)', () => {
    // Simulates the real @actions/core.getInput semantics for a workflow
    // that omits `src:` in `with:`, now that action.yml declares no default
    // for it: the runtime does not set INPUT_SRC at all, so getInput('src')
    // returns ''. Before the action.yml fix, a getInput stub that mimicked
    // the (buggy) real runtime would have returned the default-glob string
    // here instead of '', and this assertion would have failed by asserting
    // a shredded array.
    const result = parseInputs(
      fakeGetInput({
        'source-lang': 'en',
        'target-langs': 'ja',
        'locales-dir': './public/locales',
        'api-key': 'sk-or-abc',
        'github-token': 'ghp-abc',
        // 'src' intentionally omitted, and fakeGetInput returns '' for it,
        // matching real @actions/core when action.yml has no default.
      })
    );
    expect(result.srcGlobs).toEqual(['src/**/*.{js,jsx,ts,tsx,vue}']);
  });
});
