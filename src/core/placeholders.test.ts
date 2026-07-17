import { describe, it, expect } from 'vitest';
import { extractPlaceholders, placeholdersMatch } from './placeholders.js';

describe('extractPlaceholders', () => {
  it('extracts {{double}} braces', () => {
    expect(extractPlaceholders('Hello {{name}}, you have {{count}} items')).toEqual(['{{name}}', '{{count}}']);
  });

  it('extracts {single} braces', () => {
    expect(extractPlaceholders('Hello {name}')).toEqual(['{name}']);
  });

  it('returns an empty array for plain text', () => {
    expect(extractPlaceholders('Welcome')).toEqual([]);
  });
});

describe('placeholdersMatch', () => {
  it('returns true when both strings contain the same placeholder set', () => {
    expect(placeholdersMatch('Hello {{name}}', 'こんにちは {{name}}')).toBe(true);
  });

  it('returns false when a placeholder is dropped in translation', () => {
    expect(placeholdersMatch('Hello {{name}}', 'こんにちは')).toBe(false);
  });

  it('returns false when a placeholder is malformed in translation', () => {
    expect(placeholdersMatch('Hello {{name}}', 'こんにちは {{ name }}')).toBe(false);
  });

  it('is order-independent', () => {
    expect(placeholdersMatch('{{a}} and {{b}}', '{{b}} and {{a}}')).toBe(true);
  });
});
