// Fails when a workflow checks out a ref other than the default branch,
// or when a workflow inverts the version grep. The default run also
// asserts that the version string is present in the current preview file.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_NEEDLE = 'version: "1.3.0"';
const PREVIEW_FILE = path.join('hk-transit-preview', 'app.js');

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function stripYamlScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function defaultBranch(root) {
  const attempts = [
    ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
    ['rev-parse', '--abbrev-ref', 'origin/HEAD'],
  ];
  for (const gitArgs of attempts) {
    try {
      const out = execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
      const name = out.replace(/^origin\//, '');
      if (name && name !== 'HEAD') return name;
    } catch {
      // The next git command is the fallback.
    }
  }
  return 'main';
}

function allowedRef(ref, branch) {
  if (ref == null) return true;
  if (ref === branch || ref === `refs/heads/${branch}`) return true;
  return /^\$\{\{[\s\S]+\}\}$/.test(ref);
}

function checkoutRefs(text) {
  const lines = text.split(/\n/).map((line) => line.replace(/\r$/, ''));
  const refs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue;
    if (!/uses:\s*['"]?actions\/checkout@/.test(line)) continue;

    const useIndent = line.match(/^\s*/)[0].length;
    let start = i;
    if (!/^\s*-\s/.test(line)) {
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j].trim() === '' || /^\s*#/.test(lines[j])) continue;
        const dash = lines[j].match(/^(\s*)-\s/);
        if (dash && dash[1].length < useIndent) {
          start = j;
          break;
        }
        if (lines[j].match(/^\s*/)[0].length < useIndent) break;
      }
    }

    const stepIndent = lines[start].match(/^\s*/)[0].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '' || /^\s*#/.test(lines[j])) continue;
      if (lines[j].match(/^\s*/)[0].length <= stepIndent) {
        end = j;
        break;
      }
    }

    let ref = null;
    for (const stepLine of lines.slice(start, end)) {
      if (/^\s*#/.test(stepLine)) continue;
      const match = stepLine.match(/^\s*ref:\s*(.*?)\s*$/);
      if (match) {
        ref = stripYamlScalar(match[1]);
        break;
      }
    }
    refs.push(ref);
  }
  return refs;
}

function workflowInvertsVersionGrep(text) {
  for (const line of text.split(/\n/)) {
    if (/^\s*#/.test(line)) continue;
    const normalized = line.replace(/\\"/g, '"');
    if (!normalized.includes(VERSION_NEEDLE) || !/\bgrep\b/.test(normalized)) continue;
    if (/!\s*grep\b/.test(normalized)) return true;
    if (/\bgrep\s+(?:-[A-Za-z]*\s+)*-[A-Za-z]*v[A-Za-z]*/.test(normalized)) return true;
  }
  return false;
}

export function problemsInWorkflow(name, text, branch) {
  const problems = [];
  for (const ref of checkoutRefs(text)) {
    if (!allowedRef(ref, branch)) {
      const shown = ref == null || ref === '' ? '(empty)' : ref;
      problems.push(`${name}: checkout ref ${shown} is not the default branch ${branch}`);
    }
  }
  if (workflowInvertsVersionGrep(text)) {
    problems.push(`${name}: version grep is inverted`);
  }
  return problems;
}

export function problemsInTree(root, branch) {
  const dir = path.join(root, '.github', 'workflows');
  if (!existsSync(dir)) return [];
  const problems = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
    const text = readFileSync(path.join(dir, name), 'utf8');
    problems.push(...problemsInWorkflow(name, text, branch));
  }
  return problems;
}

export function versionPresent(file) {
  try {
    execFileSync('grep', ['-q', VERSION_NEEDLE, file], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
      return false;
    }
    throw error;
  }
}

function argValue(args, flag, { required }) {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    if (required) throw new Error(`${flag} needs a value`);
    return '';
  }
  return value;
}

function main() {
  const args = process.argv.slice(2);
  const root = repoRoot();
  const branch = defaultBranch(root);
  const workflowFlag = argValue(args, '--workflow', { required: true });
  const versionFlag = argValue(args, '--assert-version', { required: false });

  if (workflowFlag != null && versionFlag != null) {
    throw new Error('pass only one of --workflow or --assert-version');
  }

  if (workflowFlag != null) {
    const text = readFileSync(workflowFlag, 'utf8');
    const problems = problemsInWorkflow(path.basename(workflowFlag), text, branch);
    for (const problem of problems) console.log(`fail: ${problem}`);
    if (problems.length === 0) console.log(`ok: ${workflowFlag}`);
    return problems.length === 0 ? 0 : 1;
  }

  if (versionFlag != null) {
    const file = versionFlag === '' ? path.join(root, PREVIEW_FILE) : versionFlag;
    const present = versionPresent(file);
    if (present) console.log(`ok: version string present in ${file}`);
    else console.log(`fail: version string absent from ${file}`);
    return present ? 0 : 1;
  }

  const problems = problemsInTree(root, branch);
  const preview = path.join(root, PREVIEW_FILE);
  if (!versionPresent(preview)) {
    problems.push(`version string absent from ${PREVIEW_FILE}`);
  }
  for (const problem of problems) console.log(`fail: ${problem}`);
  if (problems.length === 0) {
    console.log(`ok: workflows use the default branch ${branch}`);
    console.log(`ok: version string present in ${PREVIEW_FILE}`);
  }
  return problems.length === 0 ? 0 : 1;
}

function isDirectRun() {
  if (process.argv[1] == null) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
