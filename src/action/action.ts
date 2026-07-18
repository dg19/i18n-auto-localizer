import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'node:path';
import { runPipeline } from '../core/pipeline.js';
import { parseInputs } from './inputs.js';
import { createOrResetBranch, commitAll, pushBranch } from './gitOps.js';
import { buildPrTitle, buildPrBody, createOrUpdatePr, type PrClient } from './pr.js';

const BRANCH_NAME = 'i18n-localizer/update-translations';

async function run(): Promise<void> {
  const inputs = parseInputs((name) => core.getInput(name));

  if (!inputs.sourceLang || inputs.targetLangs.length === 0 || !inputs.localesDir || !inputs.apiKey) {
    core.setFailed('source-lang, target-langs, locales-dir, and api-key are all required inputs.');
    return;
  }

  const cwd = process.cwd();
  const result = await runPipeline({
    sourceLang: inputs.sourceLang,
    targetLangs: inputs.targetLangs,
    localesDir: inputs.localesDir,
    srcGlobs: inputs.srcGlobs,
    cwd,
    model: inputs.model,
    apiKey: inputs.apiKey,
    dryRun: false,
  });

  const anyFailed = result.languages.some((l) => l.failedKeys.length > 0);

  if (result.changedFiles.length === 0) {
    core.info('No translation changes detected; skipping PR.');
    if (anyFailed) core.setFailed('Some keys failed to translate. See logs above.');
    return;
  }

  const relativeFiles = result.changedFiles.map((f) => path.relative(cwd, f));
  const baseBranch = github.context.ref.replace('refs/heads/', '');

  createOrResetBranch(cwd, BRANCH_NAME);
  commitAll(cwd, relativeFiles, 'chore: update translations via i18n-auto-localizer');
  pushBranch(cwd, BRANCH_NAME);

  const octokit = github.getOctokit(inputs.githubToken);
  const { owner, repo } = github.context.repo;
  const client: PrClient = {
    listPulls: (params) =>
      octokit.rest.pulls
        .list({ owner, repo, head: `${owner}:${params.head}`, base: params.base, state: 'open' })
        .then((res) => res.data),
    createPull: (params) => octokit.rest.pulls.create({ owner, repo, ...params }).then((res) => res.data),
    updatePull: (params) =>
      octokit.rest.pulls
        .update({ owner, repo, pull_number: params.pull_number, title: params.title, body: params.body })
        .then(() => undefined),
  };

  await createOrUpdatePr(client, {
    head: BRANCH_NAME,
    base: baseBranch,
    title: buildPrTitle(inputs.targetLangs),
    body: buildPrBody(result, inputs.sourceLang),
  });

  if (anyFailed) {
    core.setFailed('Some keys failed to translate. See the PR description for details.');
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
