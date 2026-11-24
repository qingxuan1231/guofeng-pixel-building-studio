'use strict';
/* 命令行加载顺序：与 index.html / city.html 中的 <script> 顺序保持一致。 */
const CORE = ['js/gf-core.js', 'js/gf-roof.js', 'js/gf-parts.js'];
const BUILD = [
  'src/ancient-build/00-common.js',
  'src/ancient-build/10-dwellings.js',
  'src/ancient-build/20-gates.js',
  'src/ancient-build/30-courtyard.js',
  'src/ancient-build/40-layout.js',
  'src/ancient-build/50-compounds.js',
  'src/ancient-build/60-garden.js',
  'src/ancient-build/70-city.js',
  'src/ancient-build/80-assembly.js'
];
const ANCIENT = CORE.concat(BUILD);
const RENDER = ['js/gf-render.js', 'js/gf-presets.js', 'js/gf-export.js'];
const CITY = ANCIENT.concat(RENDER, ['js/gf-city.js']);

module.exports = { CORE, BUILD, ANCIENT, RENDER, CITY };
