// src/action/gitOps.ts
import { execFileSync } from 'node:child_process';

export type GitRun = (cwd: string, args: string[]) => void;

export const defaultGitRun: GitRun = (cwd, args) => {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
};

export function createOrResetBranch(cwd: string, branchName: string, run: GitRun = defaultGitRun): void {
  run(cwd, ['checkout', '-B', branchName]);
}

export function commitAll(
  cwd: string,
  files: string[],
  message: string,
  run: GitRun = defaultGitRun
): void {
  run(cwd, ['add', ...files]);
  run(cwd, ['commit', '-m', message]);
}

export function pushBranch(cwd: string, branchName: string, run: GitRun = defaultGitRun): void {
  run(cwd, ['push', '--set-upstream', 'origin', branchName, '--force']);
}
