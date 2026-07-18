#!/usr/bin/env node
import { Command } from 'commander';
import process from 'node:process';
import { runPipeline, type PipelineResult } from '../src/core/pipeline.js';

function formatSummary(result: PipelineResult): string {
  const lines: string[] = [`Used keys detected: ${result.usedKeyCount}`];

  for (const lang of result.languages) {
    lines.push(
      `  [${lang.lang}] translated=${lang.translatedKeys} stamped=${lang.stampedKeys} failed=${lang.failedKeys.length}`
    );
    if (lang.failedKeys.length > 0) {
      lines.push(`    failed keys: ${lang.failedKeys.join(', ')}`);
    }
  }

  if (result.undefinedKeys.length > 0) {
    lines.push('Undefined keys (used in code, missing from source language):');
    for (const key of result.undefinedKeys) {
      lines.push(`  ${key.file}:${key.line} ${key.namespace ? key.namespace + ':' : ''}${key.key}`);
    }
  }

  if (result.dynamicUsages.length > 0) {
    lines.push('Dynamic keys (could not be statically analyzed):');
    for (const usage of result.dynamicUsages) {
      lines.push(`  ${usage.file}:${usage.line} ${usage.snippet}`);
    }
  }

  return lines.join('\n');
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('i18n-auto-localizer')
    .description('Detect in-use i18n keys and generate missing translations via an LLM');

  program
    .command('run')
    .description('Scan source, translate missing/changed keys, and write locale files')
    .requiredOption('--source-lang <lang>', 'source language code')
    .requiredOption('--target-langs <langs>', 'comma-separated target language codes')
    .requiredOption('--locales-dir <dir>', 'root directory of locale JSON files')
    .option('--src <globs>', 'comma-separated glob patterns to scan')
    .option('--model <model>', 'OpenRouter model id', 'anthropic/claude-sonnet-4.5')
    .option('--dry-run', 'preview the diff without calling the API or writing files', false)
    .action(async (opts) => {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!opts.dryRun && !apiKey) {
        console.error('Error: OPENROUTER_API_KEY environment variable is required unless --dry-run is set.');
        process.exitCode = 1;
        return;
      }

      const result = await runPipeline({
        sourceLang: opts.sourceLang,
        targetLangs: opts.targetLangs.split(',').map((s: string) => s.trim()),
        localesDir: opts.localesDir,
        srcGlobs: opts.src
          ? opts.src.split(',').map((s: string) => s.trim())
          : ['src/**/*.{js,jsx,ts,tsx,vue}'],
        cwd: process.cwd(),
        model: opts.model,
        apiKey: apiKey ?? '',
        dryRun: Boolean(opts.dryRun),
      });

      console.log(formatSummary(result));

      if (result.languages.some((l) => l.failedKeys.length > 0)) {
        process.exitCode = 1;
      }
    });

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildProgram().parseAsync(process.argv);
}
