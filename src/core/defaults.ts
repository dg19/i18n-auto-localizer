// src/core/defaults.ts
//
// Single source of truth for the default source-file glob. Keep this as an
// ARRAY, never a comma-joined string — the pattern itself contains commas
// inside `{js,jsx,ts,tsx,vue}` brace-expansion syntax, and splitting it on
// commas breaks the glob (this exact bug has already been introduced and
// fixed twice in this codebase; see bin/cli.ts and src/action/inputs.ts).
export const DEFAULT_SRC_GLOBS = ['src/**/*.{js,jsx,ts,tsx,vue}'];
