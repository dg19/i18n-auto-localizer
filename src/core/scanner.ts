import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { DynamicKeyUsage, ScanResult, UsedKey } from './types.js';

// @babel/traverse is a CJS package (module.exports.default = traverse, plus
// module.exports itself carries the same properties for interop). How that
// default import resolves differs by toolchain:
//   - Under this project's tsc config (moduleResolution: "NodeNext"), TS types
//     the default import as the whole CJS module namespace object rather than
//     unwrapping it — that namespace type has no call signature, so
//     `traverse(...)` fails to type-check, and at real Node ESM runtime the
//     import genuinely is the object, not the function; `traverse.default` is
//     the callable.
//   - Under Vitest (esbuild-bundled), the default import is already unwrapped
//     to the callable function itself, and `.default` is undefined on it.
// So neither `traverse(...)` nor `traverse.default(...)` alone works in both
// environments — we branch on the runtime shape. The `typeof traverse ===
// 'function'` check can't be used for type narrowing here (TS's static type
// for `traverse` has no call signature either way), so both branches are cast
// explicitly to the real function type, sourced via `typeof import(...)`
// rather than `typeof traverse` (the latter reproduces the broken type).
type TraverseFn = typeof import('@babel/traverse').default;
const doTraverse: TraverseFn =
  typeof traverse === 'function'
    ? (traverse as unknown as TraverseFn)
    : (traverse as unknown as { default: TraverseFn }).default;

function splitNamespace(raw: string): { namespace: string | null; key: string } {
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) {
    return { namespace: null, key: raw };
  }
  return { namespace: raw.slice(0, colonIndex), key: raw.slice(colonIndex + 1) };
}

function isTranslateCallee(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  if (t.isIdentifier(callee) && callee.name === 't') {
    return true;
  }
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    callee.object.name === 'i18n' &&
    t.isIdentifier(callee.property) &&
    callee.property.name === 't'
  ) {
    return true;
  }
  return false;
}

export function scanFileContent(code: string, filePath: string): ScanResult {
  const usedKeys: UsedKey[] = [];
  const dynamicUsages: DynamicKeyUsage[] = [];

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  doTraverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const { callee, arguments: args } = path.node;
      if (!isTranslateCallee(callee)) return;

      const firstArg = args[0];
      const line = path.node.loc?.start.line ?? 0;

      if (firstArg && t.isStringLiteral(firstArg)) {
        const { namespace, key } = splitNamespace(firstArg.value);
        usedKeys.push({ key, namespace, file: filePath, line });
      } else if (firstArg) {
        dynamicUsages.push({
          file: filePath,
          line,
          snippet: code.split('\n')[line - 1]?.trim() ?? '',
        });
      }
    },
  });

  return { usedKeys, dynamicUsages };
}
