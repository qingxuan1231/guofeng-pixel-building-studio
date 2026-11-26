/* 定位共面重叠对：输出每对重叠三角的 tag、中心坐标与重叠面积排序 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const { ANCIENT } = require(path.join(ROOT, 'cli/modules.js'));
const FILES = ANCIENT.concat(['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js']);
const ctx = { console }; ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of FILES) { const abs = path.isAbsolute(f) ? f : path.join(ROOT, f); vm.runInContext(fs.readFileSync(abs, 'utf8'), ctx, { filename: abs }); }
const GF = ctx.GF;

const mesh = GF.build({ ...GF.getPreset('temple5') });
const tris = [];
for (let t = 0; t < mesh.triCount; t++) {
  const i = t * 9;
  tris.push({
    tag: mesh.tag[t],
    A: [mesh.pos[i], mesh.pos[i+1], mesh.pos[i+2]],
    B: [mesh.pos[i+3], mesh.pos[i+4], mesh.pos[i+5]],
    C: [mesh.pos[i+6], mesh.pos[i+7], mesh.pos[i+8]]
  });
}
function plane4(a, b, c) {
  const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  let nx = u[1]*v[2]-u[2]*v[1], ny = u[2]*v[0]-u[0]*v[2], nz = u[0]*v[1]-u[1]*v[0];
  const L = Math.hypot(nx, ny, nz) || 1; nx/=L; ny/=L; nz/=L;
  if (nx+ny+nz<0) { nx=-nx; ny=-ny; nz=-nz; }
  return { nx, ny, nz, d: nx*a[0]+ny*a[1]+nz*a[2] };
}
function cmp(a, b) { const dx=Math.abs(a[0]-b[0]), dy=Math.abs(a[1]-b[1]), dz=Math.abs(a[2]-b[2]); return Math.max(dx, dy, dz); }
// 简化：只用 world 抓同平面 d 相近且包围盒重叠、中心接近/包围重叠的对
let printed = 0;
for (let i = 0; i < tris.length; i++) {
  for (let j = i + 1; j < tris.length; j++) {
    const ta = tris[i], tb = tris[j];
    if (ta.tag !== tb.tag) continue;
    const pa = plane4(...ta.A, ta.B, ta.C), pb = plane4(...tb.A, tb.B, tb.C);
    if (Math.abs(pa.nx - pb.nx) + Math.abs(pa.ny - pb.ny) + Math.abs(pa.nz - pb.nz) > 0.01) continue;
    if (Math.abs(pa.d - pb.d) > 0.002) continue;
    // 包围盒必须重叠
    const ax0 = Math.min(ta.A[0], ta.B[0], ta.C[0]), ax1 = Math.max(ta.A[0], ta.B[0], ta.C[0]),
          ay0 = Math.min(ta.A[1], ta.B[1], ta.C[1]), ay1 = Math.max(ta.A[1], ta.B[1], ta.C[1]),
          az0 = Math.min(ta.A[2], ta.B[2], ta.C[2]), az1 = Math.max(ta.A[2], ta.B[2], ta.C[2]);
    const bx0 = Math.min(tb.A[0], tb.B[0], tb.C[0]), bx1 = Math.max(tb.A[0], tb.B[0], tb.C[0]),
          by0 = Math.min(tb.A[1], tb.B[1], tb.C[1]), by1 = Math.max(tb.A[1], tb.B[1], tb.C[1]),
          bz0 = Math.min(tb.A[2], tb.B[2], tb.C[2]), bz1 = Math.max(tb.A[2], tb.B[2], tb.C[2]);
    if (ax1 <= bx0 || bx1 <= ax0 || ay1 <= by0 || by1 <= ay0 || az1 <= bz0 || bz1 <= az0) continue;
    // 粗略判断两三角中心接近且法线为水平
    if (Math.abs(pa.ny) < 0.7) continue;
    const cx = (tb.A[0]+tb.B[0]+tb.C[0])/3, cy = (tb.A[1]+tb.B[1]+tb.C[1])/3, cz = (tb.A[2]+tb.B[2]+tb.C[2])/3;
    const cc = (ta.A[0]+ta.B[0]+ta.C[0])/3;
    if (Math.hypot(cx - cc, (tb.A[1]+tb.B[1]+tb.C[1])/3 - cy, cz - (ta.A[2]+ta.B[2]+ta.C[2])/3) < 0.9) {
      if (printed++ < 40) {
        console.log(`${ta.tag}  n=(${pa.nx.toFixed(2)},${pa.ny.toFixed(2)},${pa.nz.toFixed(2)}) d=${pa.d.toFixed(3)}  A(${ta.A.map(v=>v.toFixed(2))}) B(${ta.B.map(v=>v.toFixed(2))}) C(${ta.C.map(v=>v.toFixed(2))})`);
      }
    }
  }
}
console.log('共面同 tag 临近水平对（含近似）:', printed);