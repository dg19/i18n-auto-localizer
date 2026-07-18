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
  const srcRaw = getInput('src');
  const srcGlobs = srcRaw
    ? srcRaw.split(',').map((s) => s.trim())
    : ['src/**/*.{js,jsx,ts,tsx,vue}'];
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
