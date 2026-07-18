import path from 'node:path';
import { scanSource } from './scanner.js';
import { loadNamespaceLocales } from './locales.js';
import { readLockfile, writeLockfile, setLockHash } from './lockfile.js';
import { computeDiff } from './diff.js';
import { translateBatch } from './translator.js';
import { mergeTranslations, writeLocaleFile } from './writer.js';
import { sha256 } from './hash.js';
import type { DynamicKeyUsage, TranslationTarget, UsedKey } from './types.js';

export interface PipelineOptions {
  sourceLang: string;
  targetLangs: string[];
  localesDir: string;
  srcGlobs: string[];
  cwd: string;
  model: string;
  apiKey: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
}

export interface PipelineLanguageResult {
  lang: string;
  translatedKeys: number;
  stampedKeys: number;
  failedKeys: string[];
  changed: boolean;
  orphanKeys: { namespace: string; key: string }[];
}

export interface PipelineResult {
  usedKeyCount: number;
  undefinedKeys: UsedKey[];
  dynamicUsages: DynamicKeyUsage[];
  languages: PipelineLanguageResult[];
  changedFiles: string[];
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const scan = await scanSource(options.srcGlobs, options.cwd);
  const sourceLocales = await loadNamespaceLocales(options.localesDir, options.sourceLang);
  const lockfile = await readLockfile(options.cwd);

  const languages: PipelineLanguageResult[] = [];
  const changedFiles = new Set<string>();
  let undefinedKeys: UsedKey[] = [];
  let lockfileDirty = false;

  for (const targetLang of options.targetLangs) {
    const targetLocales = await loadNamespaceLocales(options.localesDir, targetLang);
    const diffResult = computeDiff(scan.usedKeys, scan.dynamicUsages, sourceLocales, targetLocales, lockfile);
    if (undefinedKeys.length === 0) undefinedKeys = diffResult.undefinedKeys;

    let translatedKeys = 0;
    const failedKeys: string[] = [];

    if (!options.dryRun) {
      const byNamespace = new Map<string, TranslationTarget[]>();
      for (const target of diffResult.toTranslate) {
        if (!byNamespace.has(target.namespace)) byNamespace.set(target.namespace, []);
        byNamespace.get(target.namespace)!.push(target);
      }

      for (const [namespace, targets] of byNamespace) {
        const batchResult = await translateBatch(
          { apiKey: options.apiKey, model: options.model, fetchImpl: options.fetchImpl },
          targetLang,
          targets.map((t) => ({ key: t.key, sourceValue: t.sourceValue }))
        );
        failedKeys.push(...batchResult.failedKeys);
        if (batchResult.translations.size === 0) continue;

        const existing = targetLocales[namespace] ?? new Map<string, string>();
        const merged = mergeTranslations(existing, batchResult.translations);
        targetLocales[namespace] = merged;
        await writeLocaleFile(options.localesDir, targetLang, namespace, merged);
        changedFiles.add(path.join(options.localesDir, targetLang, `${namespace}.json`));

        for (const target of targets) {
          if (batchResult.translations.has(target.key)) {
            setLockHash(lockfile, namespace, target.key, sha256(target.sourceValue));
            lockfileDirty = true;
            translatedKeys++;
          }
        }
      }

      for (const stamp of diffResult.toStamp) {
        setLockHash(lockfile, stamp.namespace, stamp.key, sha256(stamp.sourceValue));
        lockfileDirty = true;
      }
    } else {
      translatedKeys = diffResult.toTranslate.length;
    }

    languages.push({
      lang: targetLang,
      translatedKeys,
      stampedKeys: diffResult.toStamp.length,
      failedKeys,
      changed: diffResult.toTranslate.length > 0 || diffResult.toStamp.length > 0,
      orphanKeys: diffResult.orphanKeys,
    });
  }

  if (!options.dryRun && lockfileDirty) {
    await writeLockfile(options.cwd, lockfile);
    changedFiles.add(path.join(options.cwd, '.i18n-localizer-lock.json'));
  }

  return {
    usedKeyCount: scan.usedKeys.length,
    undefinedKeys,
    dynamicUsages: scan.dynamicUsages,
    languages,
    changedFiles: [...changedFiles],
  };
}
