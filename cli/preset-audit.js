/* 预设配方结构审计：按结构分组核对开间、进深、逐层数组、城墙剖面与城门尺度。
   退出码：0 全部通过；1 有 error；warn 只打印不阻断。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CITY } = require('./modules');
const ROOT = path.join(__dirname, '..');

const ctx = { console };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of CITY) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const GF = ctx.GF;

const rows = [];
for (const r of GF.auditPresets()) {
  rows.push({ scope: '古建', key: r.key, name: r.name, ...r });
}
for (const p of GF.cityList) {
  const r = GF.cityAudit(GF.getCityPreset(p.key));
  rows.push({ scope: '城池', key: p.key, name: p.name, ok: r.ok, issues: r.issues });
}

let errors = 0;
let warns = 0;
for (const row of rows) {
  const es = row.issues.filter((x) => x.level === 'error');
  const ws = row.issues.filter((x) => x.level === 'warn');
  errors += es.length;
  warns += ws.length;
  if (!es.length && !ws.length) continue;
  console.log(`\n[${row.scope}] ${row.key} ${row.name}`);
  for (const i of row.issues) console.log(`  ${i.level === 'error' ? 'ERR ' : 'WARN'} ${i.key}: ${i.msg}`);
}
console.log(`\n预设结构审计：${rows.length} 套，error ${errors}，warn ${warns}`);
process.exit(errors ? 1 : 0);
