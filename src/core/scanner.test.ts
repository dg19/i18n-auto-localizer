import { describe, it, expect } from 'vitest';
import { scanFileContent } from './scanner.js';

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
