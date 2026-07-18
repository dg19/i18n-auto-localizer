// src/action/pr.ts
import type { PipelineResult } from '../core/pipeline.js';

export function buildPrTitle(targetLangs: string[]): string {
  return `i18n: update translations (${targetLangs.join(', ')})`;
}

export function buildPrBody(result: PipelineResult, sourceLang: string): string {
  const lines: string[] = [`Source language: \`${sourceLang}\``, '', '| Language | Translated | Failed |', '|---|---|---|'];

  for (const lang of result.languages) {
    lines.push(`| ${lang.lang} | ${lang.translatedKeys} | ${lang.failedKeys.length} |`);
  }

  if (result.undefinedKeys.length > 0) {
    lines.push('', '### ⚠️ Undefined keys (used in code, missing from source language)');
    for (const key of result.undefinedKeys) {
      lines.push(`- \`${key.namespace ? key.namespace + ':' : ''}${key.key}\` — ${key.file}:${key.line}`);
    }
  }

  if (result.dynamicUsages.length > 0) {
    lines.push('', '### ⚠️ Dynamic keys (could not be statically analyzed)');
    for (const usage of result.dynamicUsages) {
      lines.push(`- ${usage.file}:${usage.line} \`${usage.snippet}\``);
    }
  }

  const failedEntries = result.languages.flatMap((l) => l.failedKeys.map((k) => `${l.lang}: ${k}`));
  if (failedEntries.length > 0) {
    lines.push('', '### ❌ Translation failed for these keys');
    for (const entry of failedEntries) {
      lines.push(`- ${entry}`);
    }
  }

  return lines.join('\n');
}

export interface PrClient {
  listPulls(params: { head: string; base: string }): Promise<{ number: number }[]>;
  createPull(params: { title: string; body: string; head: string; base: string }): Promise<{ number: number }>;
  updatePull(params: { pull_number: number; title: string; body: string }): Promise<void>;
}

export async function createOrUpdatePr(
  client: PrClient,
  params: { head: string; base: string; title: string; body: string }
): Promise<number> {
  const existing = await client.listPulls({ head: params.head, base: params.base });
  if (existing.length > 0) {
    await client.updatePull({ pull_number: existing[0].number, title: params.title, body: params.body });
    return existing[0].number;
  }
  const created = await client.createPull(params);
  return created.number;
}
