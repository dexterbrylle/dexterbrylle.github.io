import { execFileSync } from 'node:child_process';

// Git dates describe actual source changes, never the time a build happens.
export function modifiedDate(...paths) {
  try {
    const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], { encoding: 'utf8' }).trim();
    return value || undefined;
  } catch {
    // Source archives may not include Git history. Omit dates we cannot establish.
    return undefined;
  }
}
