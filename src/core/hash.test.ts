import { describe, it, expect } from 'vitest';
import { sha256 } from './hash.js';

describe('sha256', () => {
  it('returns a sha256: prefixed hex digest', () => {
    const result = sha256('Welcome');
    expect(result).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(sha256('Welcome')).toBe(sha256('Welcome'));
  });

  it('differs for different input', () => {
    expect(sha256('Welcome')).not.toBe(sha256('Welcome!'));
  });
});
