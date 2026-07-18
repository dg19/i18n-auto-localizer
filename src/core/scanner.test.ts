import { describe, it, expect } from 'vitest';
import { scanFileContent, scanSource } from './scanner.js';
import path from 'node:path';

describe('scanFileContent — literal keys', () => {
  it('detects a bare t(\'key\') call', () => {
    const code = `t('hero.title');`;
    const result = scanFileContent(code, 'src/Hero.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'hero.title', namespace: null, file: 'src/Hero.tsx', line: 1 },
    ]);
  });

  it('detects an i18n.t(\'key\') call', () => {
    const code = `i18n.t('footer.copyright');`;
    const result = scanFileContent(code, 'src/Footer.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'footer.copyright', namespace: null, file: 'src/Footer.tsx', line: 1 },
    ]);
  });

  it('splits an explicit namespace prefix out of the key', () => {
    const code = `t('home:hero.subtitle');`;
    const result = scanFileContent(code, 'src/Sub.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'hero.subtitle', namespace: 'home', file: 'src/Sub.tsx', line: 1 },
    ]);
  });

  it('records the correct line number for multi-line files', () => {
    const code = `const x = 1;\nconst y = 2;\nt('third.line');`;
    const result = scanFileContent(code, 'src/Multi.tsx');
    expect(result.usedKeys[0].line).toBe(3);
  });

  it('ignores calls to functions named something other than t or i18n.t', () => {
    const code = `translate('not.tracked'); log.t('also.not.tracked');`;
    const result = scanFileContent(code, 'src/Other.tsx');
    expect(result.usedKeys).toEqual([]);
  });
});

describe('scanFileContent — hook-bound namespace', () => {
  it('associates t() calls with the namespace passed to useTranslation()', () => {
    const code = `
      function Home() {
        const { t } = useTranslation('home');
        return t('hero.title');
      }
    `;
    const result = scanFileContent(code, 'src/Home.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'hero.title', namespace: 'home', file: 'src/Home.tsx', line: 4 },
    ]);
  });

  it('associates t() calls with the namespace passed to useTranslations() (next-intl)', () => {
    const code = `
      function Home() {
        const t = useTranslations('home');
        return t('hero.title');
      }
    `;
    const result = scanFileContent(code, 'src/Home.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'hero.title', namespace: 'home', file: 'src/Home.tsx', line: 4 },
    ]);
  });

  it('leaves namespace null when useTranslation() has no argument', () => {
    const code = `
      function Generic() {
        const { t } = useTranslation();
        return t('generic.label');
      }
    `;
    const result = scanFileContent(code, 'src/Generic.tsx');
    expect(result.usedKeys[0].namespace).toBeNull();
  });

  it('keeps two sibling components binding t to different namespaces distinct', () => {
    const code = `
      function Home() {
        const { t } = useTranslation('a');
        return t('someKey');
      }

      function About() {
        const { t } = useTranslation('b');
        return t('someKey');
      }
    `;
    const result = scanFileContent(code, 'src/Siblings.tsx');
    expect(result.usedKeys).toEqual([
      { key: 'someKey', namespace: 'a', file: 'src/Siblings.tsx', line: 4 },
      { key: 'someKey', namespace: 'b', file: 'src/Siblings.tsx', line: 9 },
    ]);
  });

  it('an explicit namespace prefix on the key wins over the hook-bound namespace', () => {
    const code = `
      function Home() {
        const { t } = useTranslation('home');
        return t('common:shared.label');
      }
    `;
    const result = scanFileContent(code, 'src/Home.tsx');
    expect(result.usedKeys[0]).toEqual({
      key: 'shared.label',
      namespace: 'common',
      file: 'src/Home.tsx',
      line: 4,
    });
  });
});

describe('scanFileContent — dynamic keys', () => {
  it('flags a t(variable) call as a dynamic usage instead of a used key', () => {
    const code = `
      function Item({ id }) {
        return t(id);
      }
    `;
    const result = scanFileContent(code, 'src/Item.tsx');
    expect(result.usedKeys).toEqual([]);
    expect(result.dynamicUsages).toEqual([
      { file: 'src/Item.tsx', line: 3, snippet: 'return t(id);' },
    ]);
  });

  it('flags a template-literal-with-expression key as dynamic', () => {
    const code = 't(\`item.\${id}.label\`);';
    const result = scanFileContent(code, 'src/Item2.tsx');
    expect(result.usedKeys).toEqual([]);
    expect(result.dynamicUsages).toHaveLength(1);
  });
});

describe('scanSource', () => {
  const cwd = path.resolve(__dirname, '../../fixtures/scan-samples');

  it('scans all matching files and aggregates results', async () => {
    const result = await scanSource(['*.tsx', '*.vue'], cwd);
    const keys = result.usedKeys.map((k) => k.key).sort();
    expect(keys).toContain('hero.title');
    expect(keys).toContain('footer.label');
    expect(keys).toContain('plan.title');
  });

  it('extracts only the <script> block from .vue files (does not choke on <template>)', async () => {
    const result = await scanSource(['vue-i18n.vue'], cwd);
    expect(result.usedKeys.some((k) => k.key === 'footer.label')).toBe(true);
  });

  it('reports next-intl useTranslations() namespace binding', async () => {
    const result = await scanSource(['next-intl.tsx'], cwd);
    expect(result.usedKeys).toContainEqual(
      expect.objectContaining({ key: 'plan.title', namespace: 'pricing' })
    );
  });

  it('collects dynamic key usages across files', async () => {
    const result = await scanSource(['dynamic-key.tsx'], cwd);
    expect(result.dynamicUsages).toHaveLength(1);
  });
});
