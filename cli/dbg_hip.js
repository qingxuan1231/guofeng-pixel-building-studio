const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;
const mesh = GF.build({ ...GF.getPreset('temple5') });
// 找出 tag 含垂脊的所有三角形区间，统计每段 beamBetween 的边长
const pr = (t) => { const i = t*9; return [[mesh.pos[i],mesh.pos[i+1],mesh.pos[i+2]],[mesh.pos[i+3],mesh.pos[i+4],mesh.pos[i+5]],[mesh.pos[i+6],mesh.pos[i+7],mesh.pos[i+8]]].map(v=>v.map(x=>Math.round(x*1000)/1000)); };
let cnt = 0;
for (let t = 0; t < mesh.triCount; t++) {
  if (mesh.tag[t] !== '屋面·垂脊') continue;
  cnt++;
  if (t >= 307960 && t <= 308010) {
    const p = pr(t);
    console.log(`#${t} ${p.map(q=>q.join(',')).join(' | ')}`);
  }
}
console.log('垂脊总数=', cnt);