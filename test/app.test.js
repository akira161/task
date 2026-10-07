'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'task-test-'));
process.env.TASK_TOKEN = 'secret';
const { server } = require('../server.js');
const { parseQuick } = require('../public/parse.js');

test('parseQuick: 記法を解釈する', () => {
  const now = new Date(2026, 9, 7); // 2026-10-07 (水)
  const p = parseQuick('資料作成 #仕事 !1 @明日 >doing', now);
  assert.deepStrictEqual(p, { title: '資料作成', project: '仕事', priority: 1, due: '2026-10-08', status: 'doing' });
  assert.strictEqual(parseQuick('x @金', now).due, '2026-10-09');
  assert.strictEqual(parseQuick('x @+3d', now).due, '2026-10-10');
  assert.strictEqual(parseQuick('x @10/1', now).due, '2027-10-01');
  assert.strictEqual(parseQuick('メール@example', now).title, 'メール@example');
  assert.strictEqual(parseQuick('x !9 >bogus', now).priority, 2);
});

test('API: 認証・作成・更新・削除', async (t0) => {
  await new Promise((r) => server.listen(0, r));
  t0.after(() => server.close());
  const base = 'http://localhost:' + server.address().port;
  const call = (method, p, body, token = 'secret') =>
    fetch(base + p, {
      method, body: body && JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    });

  assert.strictEqual((await call('GET', '/api/tasks', null, 'bad')).status, 401);

  const t = await (await call('POST', '/api/tasks', { title: 'A', project: 'p' })).json();
  assert.strictEqual(t.status, 'todo');
  // ショートカット用エンドポイント（トークンはクエリでも可）
  const q = await fetch(base + '/api/quick?token=secret&text=' + encodeURIComponent('B #p !1 >doing'));
  assert.strictEqual(q.status, 201);

  const done = await (await call('PATCH', '/api/tasks/' + t.id, { status: 'done' })).json();
  assert.ok(done.doneAt);
  assert.strictEqual((await (await call('PATCH', '/api/tasks/' + t.id, { status: 'todo' })).json()).doneAt, undefined);

  let { tasks, rev } = await (await call('GET', '/api/tasks')).json();
  assert.strictEqual(tasks.length, 2);
  assert.ok(rev >= 4);
  assert.strictEqual(tasks.find((x) => x.title === 'B').status, 'doing');

  await call('DELETE', '/api/tasks/' + t.id);
  ({ tasks } = await (await call('GET', '/api/tasks')).json());
  assert.strictEqual(tasks.length, 1);

  assert.strictEqual((await call('POST', '/api/tasks', { title: '  ' })).status, 400);
  assert.notStrictEqual((await fetch(base + '/%2e%2e/server.js')).status, 200);
  assert.strictEqual((await fetch(base + '/')).status, 200);
});
