import { DEFAULT_SRC_GLOBS } from '../core/defaults.js';

export interface ActionInputs {
  sourceLang: string;
  targetLangs: string[];
  localesDir: string;
  srcGlobs: string[];
  model: string;
  apiKey: string;
  githubToken: string;
}

export function parseInputs(getInput: (name: string) => string): ActionInputs {
  // INVARIANT: action.yml's `src` input must NOT declare a `default:`.
  // GitHub Actions auto-populates INPUT_SRC from action.yml's declared default
  // before this code runs, so getInput('src') would return the default glob
  // string itself (not '') whenever a workflow omits `src:`. That would make
  // srcRaw truthy below, sending the default glob through the .split(',')
  // branch and shredding it on the commas inside `{js,jsx,ts,tsx,vue}`
  // (producing ['src/**/*.{js', 'jsx', 'ts', 'tsx', 'vue}']) instead of
  // hitting the single-element fallback array. src/core/defaults.ts is the
  // single source of truth for the default glob value — do not re-add a
  // `default:` for `src` in action.yml, or this guard silently breaks again.
  const srcRaw = getInput('src');
  const srcGlobs = srcRaw
    ? srcRaw.split(',').map((s) => s.trim())
    : DEFAULT_SRC_GLOBS;
  return {
    sourceLang: getInput('source-lang'),
    targetLangs: getInput('target-langs')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    localesDir: getInput('locales-dir'),
    srcGlobs,
    model: getInput('model') || 'anthropic/claude-sonnet-4.5',
    apiKey: getInput('api-key'),
    githubToken: getInput('github-token'),
  };
}
