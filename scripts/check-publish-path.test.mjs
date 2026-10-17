import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { problemsInTree, problemsInWorkflow, versionPresent } from './check-publish-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = '889ef8438c9a2ebd0a8edcea866e7123bb316196';

function workflow(body) {
  return `name: fixture\njobs:\n  publish:\n    steps:\n${body}`;
}

test('a workflow whose checkout ref is the pinned preview commit fails', () => {
  const text = workflow(
    ['      - uses: actions/checkout@v4', '        with:', `          ref: ${SHA}`].join('\n'),
  );
  const problems = problemsInWorkflow('pinned.yml', text, 'main');
  assert.equal(problems.length, 1);
  assert.match(problems[0], new RegExp(SHA));
  assert.match(problems[0], /not the default branch main/);
});

test('quoted checkout shas and non-default branch names fail', () => {
  const sha = workflow(
    ['      - uses: actions/checkout@v4', '        with:', `          ref: "${SHA}"`].join('\n'),
  );
  const branch = workflow(
    [
      '      - name: Checkout staging source',
      '        uses: actions/checkout@v4',
      '        with:',
      '          ref: cursor/hk-transit-preview-note-2342',
    ].join('\n'),
  );
  assert.match(problemsInWorkflow('sha.yml', sha, 'main')[0], new RegExp(SHA));
  assert.match(
    problemsInWorkflow('branch.yml', branch, 'main')[0],
    /cursor\/hk-transit-preview-note-2342/,
  );
});

test('the default branch, an omitted ref, and an event expression pass', () => {
  const cases = [
    workflow('      - uses: actions/checkout@v4\n'),
    workflow(
      ['      - uses: actions/checkout@v4', '        with:', '          ref: main'].join('\n'),
    ),
    workflow(
      [
        '      - uses: actions/checkout@v4',
        '        with:',
        '          ref: refs/heads/main',
      ].join('\n'),
    ),
    workflow(
      [
        '      - uses: actions/checkout@v4',
        '        with:',
        '          ref: ${{ github.sha }}',
      ].join('\n'),
    ),
    workflow(
      [
        '      - uses: actions/checkout@v4',
        '        with:',
        '          ref: ${{ github.event.repository.default_branch }}',
      ].join('\n'),
    ),
  ];
  for (const text of cases) {
    assert.deepEqual(problemsInWorkflow('ok.yml', text, 'main'), []);
  }
});

test('an inverted version grep fails and a presence grep does not', () => {
  const inverted = workflow(
    "      - run: |\n          ! grep -q 'version: \"1.3.0\"' pages/transit/app.js\n",
  );
  const present = workflow(
    "      - run: |\n          grep -q 'version: \"1.3.0\"' pages/transit/app.js\n",
  );
  const otherNegation = workflow(
    "      - run: |\n          ! grep -q 'main-scroll' pages/transit/index.html\n",
  );
  assert.match(problemsInWorkflow('inv.yml', inverted, 'main')[0], /version grep is inverted/);
  assert.deepEqual(problemsInWorkflow('ok.yml', present, 'main'), []);
  assert.deepEqual(problemsInWorkflow('scroll.yml', otherNegation, 'main'), []);
});

test('the version string is present on the current preview file', () => {
  assert.equal(versionPresent(path.join(root, 'hk-transit-preview', 'app.js')), true);
});

test('dev serves the repository root', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.dev, 'serve . -l 8080');
});

test('committed workflows stay on the default branch with a positive version grep', () => {
  const problems = problemsInTree(root, 'main');
  assert.deepEqual(problems, []);
  const publisher = readFileSync(
    path.join(root, '.github', 'workflows', 'publish-transit-to-github-io.yml'),
    'utf8',
  );
  assert.equal(publisher.includes('--admin'), false);
  assert.equal(publisher.includes('cursor/hk-transit-preview-note-2342'), false);
  assert.match(publisher, /grep -q 'version: "1\.3\.0"'/);
  assert.doesNotMatch(publisher, /!\s*grep\s+-q\s+'version: "1\.3\.0"'/);
});
