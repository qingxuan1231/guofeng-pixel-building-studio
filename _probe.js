require("./js/gf-core.js"); require("./js/gf-roof.js"); require("./js/gf-parts.js"); require("./js/gf-build.js"); require("./js/gf-presets.js");
const GF=globalThis.GF;
for (const [key,ppm] of [["qing",320],["qing",160],["bajiaoting",320],["jiangnan",320],["ta",320],["tengwang",320]]) {
  const r = GF.getPreset(key); GF.setDetail(GF.detailFor(ppm));
  const t0=Date.now(); const m=GF.build(r,{ppm});
  console.log(key, ppm, "tris", m.triCount, "ms", Date.now()-t0);
}
