// src/action/gitOps.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createOrResetBranch, commitAll, pushBranch } from './gitOps.js';

describe('gitOps', () => {
  it('createOrResetBranch runs git checkout -B <branch>', () => {
    const run = vi.fn();
    createOrResetBranch('/repo', 'i18n-localizer/update-translations', run);
    expect(run).toHaveBeenCalledWith('/repo', ['checkout', '-B', 'i18n-localizer/update-translations']);
  });

  it('commitAll stages the given files then commits with the given message', () => {
    const run = vi.fn();
    commitAll('/repo', ['locales/ja/common.json', '.i18n-localizer-lock.json'], 'chore: update translations', run);
    expect(run).toHaveBeenNthCalledWith(1, '/repo', ['add', 'locales/ja/common.json', '.i18n-localizer-lock.json']);
    expect(run).toHaveBeenNthCalledWith(2, '/repo', ['commit', '-m', 'chore: update translations']);
  });

  it('pushBranch force-pushes with upstream tracking so re-runs update the same PR', () => {
    const run = vi.fn();
    pushBranch('/repo', 'i18n-localizer/update-translations', run);
    expect(run).toHaveBeenCalledWith('/repo', [
      'push', '--set-upstream', 'origin', 'i18n-localizer/update-translations', '--force',
    ]);
  });
});
