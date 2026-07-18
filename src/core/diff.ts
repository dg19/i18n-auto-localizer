import type {
  UsedKey,
  DynamicKeyUsage,
  NamespaceLocaleData,
  LockfileData,
  DiffResult,
  TranslationTarget,
} from './types.js';
import { getLockHash } from './lockfile.js';
import { sha256 } from './hash.js';

function resolveNamespaces(usedKey: UsedKey, sourceLocales: NamespaceLocaleData): string[] {
  if (usedKey.namespace !== null) {
    return sourceLocales[usedKey.namespace]?.has(usedKey.key) ? [usedKey.namespace] : [];
  }
  return Object.keys(sourceLocales).filter((ns) => sourceLocales[ns].has(usedKey.key));
}

export function computeDiff(
  usedKeys: UsedKey[],
  dynamicUsages: DynamicKeyUsage[],
  sourceLocales: NamespaceLocaleData,
  targetLocales: NamespaceLocaleData,
  lockfile: LockfileData
): DiffResult {
  const toTranslate: TranslationTarget[] = [];
  const toStamp: TranslationTarget[] = [];
  const undefinedKeys: UsedKey[] = [];
  const usedByNamespaceKey = new Set<string>();

  for (const used of usedKeys) {
    const namespaces = resolveNamespaces(used, sourceLocales);
    if (namespaces.length === 0) {
      undefinedKeys.push(used);
      continue;
    }

    for (const namespace of namespaces) {
      usedByNamespaceKey.add(`${namespace} ${used.key}`);
      const sourceValue = sourceLocales[namespace]?.get(used.key);
      if (sourceValue === undefined) continue;

      const targetValue = targetLocales[namespace]?.get(used.key);
      if (targetValue === undefined) {
        toTranslate.push({ namespace, key: used.key, sourceValue });
        continue;
      }

      const lockedHash = getLockHash(lockfile, namespace, used.key);
      if (lockedHash === undefined) {
        toStamp.push({ namespace, key: used.key, sourceValue });
      } else if (lockedHash !== sha256(sourceValue)) {
        toTranslate.push({ namespace, key: used.key, sourceValue });
      }
    }
  }

  // Keys that resolved to zero source namespaces are reported as undefinedKeys and are
  // never added to usedByNamespaceKey, so without this guard they'd also look orphaned
  // in the target locale and get reported twice. Skip orphan emission for any
  // namespace/key pair already surfaced as an undefined key.
  const undefinedByNamespaceKey = new Set<string>();
  for (const undefinedKey of undefinedKeys) {
    if (undefinedKey.namespace !== null) {
      undefinedByNamespaceKey.add(`${undefinedKey.namespace} ${undefinedKey.key}`);
    }
  }

  const orphanKeys: { namespace: string; key: string }[] = [];
  for (const [namespace, valueMap] of Object.entries(targetLocales)) {
    for (const key of valueMap.keys()) {
      if (usedByNamespaceKey.has(`${namespace} ${key}`)) continue;
      if (undefinedByNamespaceKey.has(`${namespace} ${key}`)) continue;
      orphanKeys.push({ namespace, key });
    }
  }

  return { toTranslate, toStamp, undefinedKeys, dynamicUsages, orphanKeys };
}
