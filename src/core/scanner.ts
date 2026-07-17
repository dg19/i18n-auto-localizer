import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import fg from 'fast-glob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

function isTranslationHookCall(node: t.CallExpression): boolean {
  return (
    t.isIdentifier(node.callee) &&
    (node.callee.name === 'useTranslation' || node.callee.name === 'useTranslations')
  );
}

function hookNamespaceArg(node: t.CallExpression): string | null {
  const [arg] = node.arguments;
  return arg && t.isStringLiteral(arg) ? arg.value : null;
}

export function scanFileContent(code: string, filePath: string): ScanResult {
  const usedKeys: UsedKey[] = [];
  const dynamicUsages: DynamicKeyUsage[] = [];
  const lines = code.split('\n');

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const namespaceByBinding = new Map<unknown, string | null>();

  doTraverse(ast, {
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const init = path.node.init;
      if (!init || !t.isCallExpression(init) || !isTranslationHookCall(init)) return;
      const namespace = hookNamespaceArg(init);

      if (t.isObjectPattern(path.node.id)) {
        for (const prop of path.node.id.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key, { name: 't' }) &&
            t.isIdentifier(prop.value)
          ) {
            const binding = path.scope.getBinding(prop.value.name);
            if (binding) namespaceByBinding.set(binding, namespace);
          }
        }
      } else if (t.isIdentifier(path.node.id)) {
        const binding = path.scope.getBinding(path.node.id.name);
        if (binding) namespaceByBinding.set(binding, namespace);
      }
    },
  });

  doTraverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const { callee, arguments: args } = path.node;
      const line = path.node.loc?.start.line ?? 0;

      const isBareT = t.isIdentifier(callee) && callee.name === 't';
      const isI18nT =
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        callee.object.name === 'i18n' &&
        t.isIdentifier(callee.property) &&
        callee.property.name === 't';
      if (!isBareT && !isI18nT) return;

      const firstArg = args[0];
      if (!firstArg) return;

      if (t.isStringLiteral(firstArg)) {
        const { namespace: explicitNs, key } = splitNamespace(firstArg.value);
        let namespace = explicitNs;
        if (namespace === null && isBareT && t.isIdentifier(callee)) {
          const binding = path.scope.getBinding(callee.name);
          if (binding && namespaceByBinding.has(binding)) {
            namespace = namespaceByBinding.get(binding)!;
          }
        }
        usedKeys.push({ key, namespace, file: filePath, line });
        return;
      }

      dynamicUsages.push({ file: filePath, line, snippet: lines[line - 1]?.trim() ?? '' });
    },
  });

  return { usedKeys, dynamicUsages };
}

function extractVueScript(code: string): { script: string; startLine: number } {
  const match = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return { script: '', startLine: 0 };
  const startLine = code.slice(0, match.index).split('\n').length - 1;
  return { script: match[1], startLine };
}

export async function scanSource(patterns: string[], cwd: string): Promise<ScanResult> {
  const files = await fg(patterns, { cwd, absolute: false });
  const usedKeys: UsedKey[] = [];
  const dynamicUsages: DynamicKeyUsage[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(cwd, relativePath);
    const raw = await readFile(absolutePath, 'utf8');

    let result: ScanResult;
    if (relativePath.endsWith('.vue')) {
      const { script, startLine } = extractVueScript(raw);
      if (!script) continue;
      result = scanFileContent(script, relativePath);
      result.usedKeys.forEach((k) => (k.line += startLine));
      result.dynamicUsages.forEach((d) => (d.line += startLine));
    } else {
      result = scanFileContent(raw, relativePath);
    }

    usedKeys.push(...result.usedKeys);
    dynamicUsages.push(...result.dynamicUsages);
  }

  return { usedKeys, dynamicUsages };
}
