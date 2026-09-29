import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const plansRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../plans');
const projectRoot = resolve(plansRoot, '..');
const backlog = JSON.parse(readFileSync(resolve(plansRoot, 'backlog.json'), 'utf8'));
const coverage = JSON.parse(readFileSync(resolve(plansRoot, 'coverage.json'), 'utf8'));
const tasks = new Map();
const statuses = new Set([
  'planned',
  'awaiting_user_install',
  'implemented_pending_verification',
  'in_progress',
  'done'
]);

for (const task of backlog.tasks) {
  assert.ok(!tasks.has(task.id), `Duplicate task ID: ${task.id}`);
  assert.ok(statuses.has(task.status), `Unknown status: ${task.id}`);
  assert.ok(
    task.title && task.milestone && task.deliverables.length && task.acceptance.length,
    `Incomplete task: ${task.id}`
  );
  assert.ok(Array.isArray(task.dependsOn), `Missing dependencies: ${task.id}`);
  const document = resolve(plansRoot, task.document);
  assert.ok(document.startsWith(`${plansRoot}${sep}`), `Document escapes plans: ${task.id}`);
  assert.ok(existsSync(document), `Missing document: ${task.document}`);
  assert.ok(readFileSync(document, 'utf8').includes(task.id), `Task missing from document: ${task.id}`);
  tasks.set(task.id, task);
}

const visited = new Set();
const visiting = new Set();
function visit(id) {
  assert.ok(tasks.has(id), `Unknown prerequisite: ${id}`);
  assert.ok(!visiting.has(id), `Circular dependency at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of tasks.get(id).dependsOn) visit(dependency);
  visiting.delete(id);
  visited.add(id);
}
for (const id of tasks.keys()) visit(id);
for (const task of tasks.values()) {
  if (task.status !== 'done') continue;
  for (const dependency of task.dependsOn)
    assert.equal(
      tasks.get(dependency).status,
      'done',
      `Completed task ${task.id} has unfinished prerequisite ${dependency}`
    );
}

for (const [category, expected] of Object.entries(backlog.expectedCounts)) {
  assert.equal(backlog.tasks.filter((task) => task.category === category).length, expected, `${category} task count`);
}
for (let index = 1; index <= 16; index += 1) {
  const prefix = `O${String(index).padStart(2, '0')}-`;
  assert.equal(backlog.tasks.filter((task) => task.id.startsWith(prefix)).length, 3, `${prefix} requires three tasks`);
}

const requiredScenarios = backlog.tasks.filter((task) => ['office', 'securities', 'protocol'].includes(task.category));
assert.equal(coverage.scenarios.length, 31, 'Coverage matrix requires 31 scenarios');
const coveredTasks = new Set();
const coveredScenarios = new Set();
for (const entry of coverage.scenarios) {
  assert.ok(!coveredScenarios.has(entry.scenarioId), `Duplicate scenario coverage: ${entry.scenarioId}`);
  coveredScenarios.add(entry.scenarioId);
  assert.match(
    entry.scenarioId,
    /^(O(0[1-9]|1[0-6])|S0[1-5]|P(0[1-9]|10))$/,
    `Invalid scenario ID: ${entry.scenarioId}`
  );
  assert.equal(
    entry.taskIds.length,
    entry.scenarioId.startsWith('O') ? 3 : 1,
    `Wrong task count for ${entry.scenarioId}`
  );
  for (const id of entry.taskIds) {
    assert.ok(!coveredTasks.has(id), `Duplicate task coverage: ${id}`);
    assert.ok(tasks.has(id), `Unknown covered task: ${id}`);
    assert.equal(tasks.get(id).status, 'done', `Covered scenario task is not done: ${id}`);
    coveredTasks.add(id);
  }
  for (const field of ['replayTests', 'stateTests']) {
    assert.ok(Array.isArray(entry[field]) && entry[field].length > 0, `Missing ${field}: ${entry.scenarioId}`);
    for (const relative of entry[field]) {
      const testFile = resolve(projectRoot, relative);
      assert.ok(testFile.startsWith(`${projectRoot}${sep}`), `Coverage path escapes project: ${relative}`);
      assert.ok(existsSync(testFile), `Missing coverage test: ${relative}`);
      assert.match(readFileSync(testFile, 'utf8'), /\bexpect\(/, `Coverage test has no assertion: ${relative}`);
    }
  }
}
assert.equal(coveredTasks.size, 63, 'Coverage matrix requires 48 office tasks, 5 securities flows and 10 experiments');
for (const task of requiredScenarios)
  assert.ok(coveredTasks.has(task.id), `Missing scenario task coverage: ${task.id}`);

process.stdout.write(
  `Validated ${tasks.size} tasks and ${coverage.scenarios.length} scenarios: IDs, documents, dependencies and 63 task evidence links.\n`
);
