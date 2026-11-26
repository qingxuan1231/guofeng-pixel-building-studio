// 快速定位 temple5 中 >0.55m 的 '鼓楼·顶·垂脊'/'钟楼·顶·垂脊' 三角形的坐标块
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { ANCIENT } = require('./modules');
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const GF = ctx.GF;

const m = GF.build(GF.getPreset('temple5'));
function e(p, q) { return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]); }

const byTag = {};
for (let t = 0; t < m.triCount; t++) {
  if (!/顶·垂脊/.test(m.tag[t])) continue;
  const i = t * 9;
  const A = [m.pos[i], m.pos[i+1], m.pos[i+2]];
  const B = [m.pos[i+3], m.pos[i+4], m.pos[i+5]];
  const C = [m.pos[i+6], m.pos[i+7], m.pos[i+8]];
  const mx = Math.max(e(A,B), e(B,C), e(C,A));
  if (mx > 0.55) {
    byTag[m.tag[t]] = (byTag[m.tag[t]] || 0) + 1;
    if (Object.keys(byTag).length <= 4) {
      console.log(`大三角 ${m.tag[t]} 最长边=${mx.toFixed(3)}`);
      console.log(`  A=(${A.map(v=>v.toFixed(2)).join(',')}) B=(${B.map(v=>v.toFixed(2)).join(',')}) C=(${C.map(v=>v.toFixed(2)).join(',')})`);
    }
  }
}
console.log('鼓楼/钟楼·顶·垂脊 >0.55m:', JSON.stringify(byTag));