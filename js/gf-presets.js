/* ============================================================================
 * 国风古建像素工坊 · 配方（预设 / 随机 / 归一化）
 * ==========================================================================*/
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});

  const DEF = {
    type: 'hall',
    name: '厅堂',
    seed: 20261123,
    bays: 3, bayW: 3.2, depth: 7.0, floors: 1, floorH: 3.4,
    baseH: 0.6, steps: 3, railing: false, stepW: 2.6,
    pedestal: 'xumizuo', railStyle: 'marble',
    wallMat: 'plaster', colMat: 'timber', tile: 'tile', tileB: 'tileB',
    winW: 1.4, winH: 1.5, winPattern: 'step',
    doorW: 1.9, doorH: 2.8, doorStyle: 'leaf', doorLeaves: 4,
    eave: 1.0, slope: 0.55, upturn: 0.35,
    roofType: 'gableHip', ridgeStyle: 'plain', beasts: 0, finial: false, tiers: 1,
    pingzuo: false, pingzuoStyle: 'wood', fujie: false, fujieR: 1.6,
    floorHList: [], shrinkList: [], eaveList: [], dgList: [],
    baoxia: false, baoxiaD: 1.3, baoxiaW: 0.44,
    terraceGate: false, huamen: false,
    trimColor: '', trimMat: null,
    dougong: false, dgScale: 1, dgStyle: 'mid', dgEye: false, queti: false,
    xuanYu: false, windDuo: false,
    plaque: true, lanterns: false, lions: false, censer: false,
    couplet: false, menZan: false, baogu: false, ceiling: 'none',
    horseWall: false, radius: 2.0, sides: 6,
    width: 10, wallH: 5.0, gateW: 3.2, gateH: 4.2, depthTower: 4.8,
    courtW: 20, courtD: 18, courtStyle: 'siheyuan', span: 12, bridgeW: 3.2, arch: 1.4,
    /* ---- 阶段④ 布局类 ---- */
    jin: 1, axisRaise: true, fangStyle: 'classic',
    /* ---- 阶段③ 城制（city）---- */
    cityW: 200, cityD: 180, wallBaseW: 2.5, wallTopW: 1.25,
    merlon: true, parapet: true, merlonStep: 2.2, merlonW: 0.55, merlonH: 0.66,
    parapetH: 0.42,
    gateCount: 3, gateTower: true, gateSide: 'four',
    bastionSpacing: 22, bastionN: 0, bastionProj: 1.6, bastionW: 0, bastionTower: true, cornerTower: true,
    blockW: 18, blockD: 16, streetW: 3, blocksX: 5, blocksZ: 4, blockWallH: 1.2,
    axisHalls: 3, axisPalace: true, palaceCorner: 'center',
    moatW: 6, moatD: 1.2, moatBridge: true, cityShape: 'rect',
    wengcheng: false, wengD: 10, wengW: 18, wengOffset: 0.35, arrowTower: true,
    drawbridge: false, bridgeUp: false,
    life: true, lifeDensity: 0.55, night: false,
    northW: 0,
    innerW: 0, innerD: 0, palaceW: 0, palaceD: 0,
    realW: 0, realD: 0, scale: 1,
    cut: { front: false, back: false, left: false, right: false, roof: false },
    interior: [],
    env: {
      showGround: false,
      groundType: 'plain', ground: 'stone', groundSize: 13,
      waterW: 6, waterSide: 'front',
      trees: ['pine'],
      rocks: 1, pond: null, banners: 0, path: true, props: [], move: {}
    },
    render: {
      palette: 'qingya', ppm: 16, pitch: 30, yaw: 45, dirs: 1,
      outline: true, shadow: true, sunAz: null, shadowAngle: 1.15,
      transparent: true,
      style: 'pixel', styleAmount: 0.75
    }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  GF.DEFAULT_RECIPE = clone(DEF);

  GF.normalize = function (src) {
    const r = Object.assign(clone(DEF), clone(src || {}));
    if (!((GF.ERA || {})[r.era])) r.era = 'qing';
    r.cut = Object.assign({ front: false, back: false, left: false, right: false, roof: false }, src && src.cut);
    r.env = Object.assign(clone(DEF.env), src && src.env);
    r.render = Object.assign(clone(DEF.render), src && src.render);
    if (!Array.isArray(r.interior)) r.interior = [];
    if (!Array.isArray(r.env.trees)) r.env.trees = ['pine'];
    if (!Array.isArray(r.env.props)) r.env.props = [];
    // 组件条落进去的自由件（数量不限、可单独调高度 / 旋转）也随配方保存
    if (!Array.isArray(r.env.items)) r.env.items = [];
    // 预设自带的环境陈设（树 / 假山 / 幡 / 道具）展开后的可编辑清单；
    // 没展开时留空，首次构建由 environment() 按 trees / rocks / props / banners 生成
    if (!Array.isArray(r.env.auto)) r.env.auto = null;
    // 逐栋改写（院落里每栋建筑一份覆盖，按单体 id 存：main1 / wingE / 倒座 ……）
    if (!r.units || typeof r.units !== 'object' || Array.isArray(r.units)) r.units = {};
    // 逐层数组：旧配方 / 手写 JSON 若漏写或写成非数组，归一为空数组，保证 file:// 打开不报错
    for (const ak of ['floorHList', 'shrinkList', 'eaveList', 'dgList']) {
      if (!Array.isArray(r[ak])) r[ak] = [];
    }
    // 城制字段：旧配方缺省 / 非法值回落默认档，保证旧配方与手写 JSON 可直接构建
    const cityNum = (k, d, allowZero) => {
      const v = Number(r[k]);
      r[k] = (isFinite(v) && (allowZero ? v >= 0 : v > 0)) ? v : d;
    };
    cityNum('cityW', DEF.cityW); cityNum('cityD', DEF.cityD);
    cityNum('wallBaseW', DEF.wallBaseW); cityNum('wallTopW', DEF.wallTopW);
    cityNum('gateW', DEF.gateW); cityNum('gateH', DEF.gateH);
    cityNum('bastionSpacing', DEF.bastionSpacing, true); cityNum('bastionN', DEF.bastionN, true); cityNum('bastionProj', DEF.bastionProj);
    cityNum('bastionW', DEF.bastionW, true);
    cityNum('merlonStep', DEF.merlonStep); cityNum('merlonW', DEF.merlonW); cityNum('merlonH', DEF.merlonH, true);
    cityNum('parapetH', DEF.parapetH, true);
    cityNum('wengD', DEF.wengD); cityNum('wengW', DEF.wengW); cityNum('wengOffset', DEF.wengOffset, true);
    cityNum('blockW', DEF.blockW, true); cityNum('blockD', DEF.blockD, true); cityNum('streetW', DEF.streetW);
    cityNum('blocksX', DEF.blocksX); cityNum('blocksZ', DEF.blocksZ); cityNum('blockWallH', DEF.blockWallH);
    cityNum('axisHalls', DEF.axisHalls, true); cityNum('moatW', DEF.moatW, true); cityNum('moatD', DEF.moatD);
    cityNum('innerW', DEF.innerW, true); cityNum('innerD', DEF.innerD, true);
    cityNum('palaceW', DEF.palaceW, true); cityNum('palaceD', DEF.palaceD, true);
    cityNum('northW', DEF.northW, true);
    cityNum('realW', DEF.realW, true); cityNum('realD', DEF.realD, true); cityNum('scale', DEF.scale);
    r.life = r.life !== false;
    r.lifeDensity = Math.max(0.1, Math.min(1, Number(r.lifeDensity) || DEF.lifeDensity));
    r.night = r.night === true;
    // 阶段④ 布局字段：旧配方缺省 / 非法值回落默认档
    r.jin = Math.max(1, Math.min(5, Math.round(Number(r.jin) || 1)));
    r.axisRaise = r.axisRaise !== false;
    if (['classic', 'shifang'].indexOf(r.fangStyle) < 0) r.fangStyle = 'classic';
    r.gateCount = Number(r.gateCount);
    if ([1, 3, 5].indexOf(r.gateCount) < 0) r.gateCount = 3;
    if (r.cityShape !== 'trapezoid') r.cityShape = 'rect';
    if (['corner', 'north'].indexOf(r.palaceCorner) < 0) r.palaceCorner = 'center';
    if (['front', 'two', 'four'].indexOf(r.gateSide) < 0) r.gateSide = 'four';
    // 瓦色联动
    const tileMap = {
      grey: ['tile', 'tileB'], celadon: ['glazeG', 'glazeGD'],
      yellow: ['glazeY', 'glazeYD'], blue: ['glazeB', 'glazeBD'], clay: ['terracotta', 'terracotta'],
      thatch: ['thatch', 'thatchB']
    };
    if (tileMap[r.tileColor]) {
      r.tile = tileMap[r.tileColor][0];
      r.tileB = tileMap[r.tileColor][1];
    } else if (r.tile !== 'tile') {
      r.tileB = r.tile;
    } else {
      r.tileB = 'tileB';
    }
    // 剪边瓦色
    const trimMap = { gold: 'glazeY', green: 'glazeG', blue: 'glazeB', grey: 'tileEnd', white: 'marble' };
    r.trimMat = trimMap[r.trimColor] || null;
    return r;
  };

  /* ------------------------------ 预设 ------------------------------ */
  const PRESETS = {
    jiangnan: {
      name: '江南民居', type: 'house', seed: 101, era: 'ming',
      bays: 3, bayW: 2.9, depth: 6.0, floors: 2, floorH: 3.0,
      baseH: 0.35, steps: 2, wallMat: 'plaster', colMat: 'wood',
      tileColor: 'grey', eave: 0.7, slope: 0.5, upturn: 0.18,
      roofType: 'gable', winPattern: 'lantern', winW: 1.1, winH: 1.2,
      doorW: 1.5, doorH: 2.3, plaque: false, lanterns: true,
      interior: [{ kind: 'table', x: 0, z: 0.6 }, { kind: 'stool', x: 0.9, z: 0.6 }, { kind: 'stool', x: -0.9, z: 0.6 }, { kind: 'shelf', x: -2.2, z: -1.6 }],
      env: { ground: 'stone', groundSize: 12, trees: ['willow', 'plum'], rocks: 1, pond: { x: 4.6, z: 4.2, w: 3.2, d: 2.2 }, banners: 0, path: true }
    },
    huizhou: {
      name: '徽州民居', type: 'house', seed: 102, era: 'ming',
      bays: 3, bayW: 2.6, depth: 5.2, floors: 2, floorH: 2.9,
      baseH: 0.3, steps: 2, wallMat: 'plaster', colMat: 'wood',
      tileColor: 'grey', eave: 0.5, slope: 0.45, upturn: 0.12,
      roofType: 'gable', winPattern: 'straight', winW: 1.0, winH: 1.1,
      doorW: 1.4, doorH: 2.2, plaque: true, horseWall: true, lanterns: true,
      interior: [{ kind: 'table', x: 0, z: 0 }, { kind: 'altar', x: 0, z: -1.6 }, { kind: 'bench' , x: 1.6, z: 0.4 }],
      env: { ground: 'stone', groundSize: 12, trees: ['bamboo', 'plum'], rocks: 2, pond: null, banners: 0, path: true }
    },
    tang: {
      name: '唐风大殿', type: 'hall', seed: 103, era: 'tang',
      bays: 5, bayW: 3.4, depth: 9.5, floors: 1, floorH: 4.2,
      baseH: 1.0, steps: 4, railing: true, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.4, slope: 0.4, upturn: 0.3,
      roofType: 'hip', ridgeStyle: 'plain', beasts: 0,
      winPattern: 'straight', winW: 1.3, winH: 1.6,
      doorStyle: 'panel', doorW: 2.2, doorH: 3.0,
      dougong: true, dgScale: 0.65, plaque: true, lions: true, censer: true,
      interior: [{ kind: 'altar', x: 0, z: -1.6 }, { kind: 'screen', x: 0, z: -3 }, { kind: 'table', x: 0, z: 0.8 }],
      env: { ground: 'stone', groundSize: 15, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 2, path: true }
    },
    qing: {
      name: '清式宫殿', type: 'hall', seed: 104,
      bays: 5, bayW: 3.6, depth: 10, floors: 1, floorH: 4.8,
      baseH: 1.2, steps: 5, railing: true, wallMat: 'zhu', colMat: 'timber',
      tileColor: 'yellow', eave: 1.5, slope: 0.55, upturn: 0.4,
      roofType: 'hip', tiers: 2, ridgeStyle: 'ornate', beasts: 5,
      winPattern: 'step', winW: 1.5, winH: 1.9,
      doorStyle: 'leaf', doorW: 2.4, doorH: 3.2,
      dougong: true, dgScale: 1.05, queti: true,
      plaque: true, lions: true, censer: true, lanterns: true,
      interior: [{ kind: 'altar', x: 0, z: -2 }, { kind: 'screen', x: 0, z: -3.4 }, { kind: 'stool', x: 2, z: 0 }],
      env: { ground: 'marble', groundSize: 16, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 2, path: true }
    },
    wujian: {
      name: '五间歇山正殿', type: 'hall', seed: 133,
      bays: 5, bayW: 3.4, depth: 9.0, floors: 1, floorH: 4.0,
      baseH: 0.9, steps: 3, railing: true, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.3, slope: 0.45, upturn: 0.32,
      roofType: 'gableHip', ridgeStyle: 'plain', beasts: 0,
      winPattern: 'straight', winW: 1.3, winH: 1.5,
      doorStyle: 'panel', doorW: 2.2, doorH: 3.0,
      dougong: true, dgScale: 0.8, queti: true, plaque: true, lions: true, censer: true,
      interior: [{ kind: 'altar', x: 0, z: -1.8 }, { kind: 'screen', x: 0, z: -3.2 }, { kind: 'table', x: 0, z: 0.8 }],
      env: { ground: 'stone', groundSize: 16, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 2, path: true }
    },
    xieshan: {
      name: '歇山厅堂', type: 'hall', seed: 105,
      bays: 3, bayW: 3.4, depth: 8.0, floors: 1, floorH: 3.8,
      baseH: 0.7, steps: 3, railing: false, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.1, slope: 0.5, upturn: 0.35,
      roofType: 'gableHip', ridgeStyle: 'plain',
      winPattern: 'step', winW: 1.4, winH: 1.6,
      doorStyle: 'leaf', doorW: 2.0, doorH: 2.8,
      queti: true, plaque: true, lanterns: true,
      interior: [{ kind: 'table', x: 0, z: 0 }, { kind: 'screen', x: 0, z: -2.4 }, { kind: 'shelf', x: -2.6, z: -1.8 }],
      env: { ground: 'stone', groundSize: 14, trees: ['pine', 'gingko'], rocks: 2, pond: { x: 5, z: 4.6, w: 3.4, d: 2.4 }, banners: 0, path: true }
    },
    ting: {
      name: '六角亭', type: 'pavilion', seed: 106,      sides: 6, radius: 2.1, floorH: 2.9, baseH: 0.4, steps: 2,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 0.9, slope: 0.7, upturn: 0.55, finial: true, railStyle: 'beauty',
      plaque: true, table: true, lanterns: true,
      env: { ground: 'grass', groundSize: 12, trees: ['bamboo', 'pine'], rocks: 3, pond: { x: -4.6, z: 3.8, w: 3.2, d: 2.4 }, banners: 0, path: true }
    },
    bajiaoting: {
      name: '八角亭', type: 'pavilion', seed: 132,
      sides: 8, radius: 2.3, floorH: 3.0, baseH: 0.45, steps: 2,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 0.95, slope: 0.68, upturn: 0.5, finial: true, railStyle: 'beauty',
      plaque: true, table: true, lanterns: true,
      env: { ground: 'grass', groundSize: 13, trees: ['bamboo', 'pine'], rocks: 2, pond: null, banners: 0, path: true }
    },
    yuandian: {
      name: '圆殿·圆形平面', type: 'round', seed: 134,
      bays: 3, bayW: 3.2, roundR: 3.6, floorH: 4.2, floors: 1,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 1.0, slope: 0.6, upturn: 0.5,
      plaque: false,
      env: { ground: 'marble', groundSize: 16, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 0, path: true, props: ['stonelamp', 'stonelamp'] }
    },
    lou: {
      name: '三层楼阁', type: 'ge', seed: 107,      bays: 3, bayW: 3.0, depth: 6.8, floors: 3, floorH: 3.0,
      pingzuo: true, pingzuoStyle: 'wood',
      baseH: 0.8, steps: 3, railing: false, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.0, slope: 0.5, upturn: 0.4,
      roofType: 'gableHip', ridgeStyle: 'plain', finial: false,
      winPattern: 'step', winW: 1.2, winH: 1.3,
      doorStyle: 'leaf', doorW: 1.8, doorH: 2.4,
      queti: true, plaque: true, lanterns: true,
      interior: [{ kind: 'table', x: 0, z: 0 }, { kind: 'bed', x: -2, z: -1.4 }, { kind: 'shelf', x: 2, z: -1.4 }],
      env: { ground: 'stone', groundSize: 14, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    ta: {
      name: '七层宝塔', type: 'pagoda', seed: 108,
      tiers: 7, radius: 2.5, floorH: 2.2, baseH: 0.6,
      colMat: 'timber', tileColor: 'grey', eave: 0.75, slope: 0.6, finial: true,
      plaque: false,
      env: { ground: 'stone', groundSize: 16, trees: ['pine', 'pine', 'gingko'], rocks: 2, pond: { x: 6, z: 5, w: 3.4, d: 2.6 }, banners: 2, path: true }
    },
    muta: {
      name: '木塔·五层', type: 'pagoda', seed: 131,
      tiers: 5, radius: 2.8, floorH: 2.8, baseH: 0.9, steps: 3, railing: true, railStyle: 'marble',
      colMat: 'timber', tileColor: 'grey', eave: 1.0, slope: 0.52, finial: true, pingzuo: true,
      fujie: true, fujieR: 1.7,
      plaque: true,
      env: { ground: 'stone', groundSize: 18, trees: ['pine', 'pine'], rocks: 2, pond: null, banners: 2, path: true }
    },
    paifang: {
      name: '三间牌坊', type: 'archway', seed: 109,
      bayW: 3.0, floorH: 4.2, colMat: 'timber', tileColor: 'grey',
      plaque: true, eave: 0.6, slope: 0.5,
      env: { ground: 'stone', groundSize: 12, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 2, path: true }
    },
    chenglou: {
      name: '城门楼', type: 'gate', seed: 110,
      width: 11, wallH: 5.4, gateW: 3.4, gateH: 4.4, depthTower: 4.8, floorH: 3.4,
      colMat: 'timber', tileColor: 'grey', eave: 1.1, slope: 0.55,
      wallMat: 'brick', plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 16, trees: ['pine'], rocks: 1, pond: null, banners: 2, path: true }
    },
    siheyuan: {
      name: '宅院·怡红院式', type: 'courtyard', seed: 111,
      courtW: 18, courtD: 16,
      bays: 3, bayW: 2.6, depth: 5.4, floors: 1, floorH: 3.4,
      baseH: 0.45, steps: 3, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.1, slope: 0.5, roofType: 'gable',
      winPattern: 'step', winW: 1.3, winH: 1.4, doorW: 2.0, doorH: 2.7,
      plaque: true, lanterns: true,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [
        { kind: 'bed', x: -1.2, z: -1.9 },
        { kind: 'table', x: 1.0, z: -1.4 },
        { kind: 'screen', x: 0.2, z: -2.5 },
        { kind: 'shelf', x: -2.8, z: -1.0 },
        { kind: 'lamp', x: 2.7, z: 0.1 },
        { kind: 'altar', x: 0, z: 0.2 },
        { kind: 'table', x: 0, z: 2.2 },
        { kind: 'stool', x: 0.95, z: 2.2 },
        { kind: 'stool', x: -0.95, z: 2.2 }
      ],
      env: { ground: 'brick', groundSize: 9, trees: ['bamboo', 'plum', 'gingko'], rocks: 1, pond: { x: 3.6, z: 5.6, w: 2.2, d: 1.5 }, banners: 0, path: true }
    },
    xiaoxiang: {
      name: '宅院·潇湘馆式', type: 'courtyard', seed: 113,
      courtW: 16, courtD: 15, wallMat: 'plaster', colMat: 'wood',
      tileColor: 'grey', eave: 1.3, slope: 0.45, floorH: 3.2, baseH: 0.4,
      winPattern: 'ice', winW: 1.2, winH: 1.3, doorW: 1.8, doorH: 2.5,
      plaque: true, lanterns: true,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [
        { kind: 'table', x: 0, z: -1.2 },
        { kind: 'shelf', x: -2.4, z: -1.6 },
        { kind: 'screen', x: 0, z: -2.4 },
        { kind: 'lamp', x: 2.4, z: 0.4 },
        { kind: 'stool', x: 0.8, z: -0.6 }
      ],
      env: { ground: 'stone', groundSize: 8, trees: ['bamboo', 'bamboo', 'bamboo'], rocks: 2, pond: null, banners: 0, path: true }
    },
    langqiao: {
      name: '廊桥', type: 'bridge', seed: 112,
      span: 12, bridgeW: 3.2, arch: 1.6, baseH: 0.9, colMat: 'timber',
      tileColor: 'grey', eave: 0.6,
      env: { ground: 'grass', groundSize: 14, trees: ['willow', 'bamboo'], rocks: 2, pond: { x: 0, z: 0, w: 9, d: 3.6 }, banners: 0, path: false }
    },
    yuanlin: {
      name: '园林·叠山理水', type: 'courtyard', seed: 114,
      courtW: 20, courtD: 18, courtStyle: 'garden',
      bays: 3, bayW: 2.6, depth: 4.8, floorH: 3.2, baseH: 0.4, steps: 2,
      wallMat: 'plaster', colMat: 'wood', tileColor: 'grey',
      eave: 0.9, slope: 0.45, roofType: 'roll', upturn: 0.4,
      winPattern: 'ice', doorW: 1.8, doorH: 2.5, plaque: true, lanterns: true,
      xuanYu: true, windDuo: true,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [
        { kind: 'table', x: 0, z: -0.8 }, { kind: 'screen', x: 0, z: -2.0 },
        { kind: 'shelf', x: -2.2, z: -1.4 }, { kind: 'lamp', x: 2.2, z: 0 }
      ],
      env: { ground: 'grass', groundSize: 11, trees: ['bamboo', 'plum'], rocks: 1, pond: null, banners: 0, path: true, props: ['penjing', 'stonelamp'] },
      render: { palette: 'qinglv', style: 'ink', styleAmount: 0.7 }
    },
    siyuan: {
      name: '寺院·山门大殿', type: 'courtyard', seed: 115,
      courtW: 22, courtD: 22, courtStyle: 'temple',
      bays: 5, bayW: 2.6, depth: 5.2, floorH: 3.6, baseH: 0.9, steps: 4,
      railing: true, pedestal: 'xumizuo', wallMat: 'zhu', colMat: 'timber',
      tileColor: 'grey', eave: 1.2, slope: 0.5, roofType: 'hip', ridgeStyle: 'ornate', beasts: 3,
      dougong: true, dgScale: 0.95, dgStyle: 'full', dgEye: true, queti: true,
      plaque: true, censer: true, lions: true, lanterns: true,
      winPattern: 'step', doorW: 2.2, doorH: 3.0,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [], // 大殿佛龛组由 courtyardTemple 按殿内地面标高生成（居中对称）
      env: { ground: 'stone', groundSize: 13, trees: ['pine', 'gingko'], rocks: 1, pond: null, banners: 0, path: true, props: ['stonelamp', 'stele'] }
    },
    temple5: {
      name: '寺·五进中轴', type: 'courtyard', seed: 411,
      courtW: 24, courtD: 34, courtStyle: 'temple5',
      bays: 5, bayW: 2.6, depth: 5.2, floorH: 3.6, baseH: 0.9, steps: 4,
      railing: true, pedestal: 'xumizuo', wallMat: 'zhu', colMat: 'timber',
      tileColor: 'grey', eave: 1.2, slope: 0.5, roofType: 'hip', ridgeStyle: 'ornate', beasts: 3,
      dougong: true, dgScale: 0.9, dgStyle: 'full', queti: true,
      plaque: true, censer: true, lions: true, lanterns: true,
      winPattern: 'step', doorW: 2.2, doorH: 3.0,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [{ kind: 'altar', x: 0, z: -1.6 }, { kind: 'screen', x: 0, z: -3.0 }],
      env: { ground: 'stone', groundSize: 15, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 0, path: true, props: ['stonelamp', 'stele'] }
    },
    daoguan: {
      name: '道观·中路紧凑', type: 'courtyard', seed: 412,
      courtW: 20, courtD: 26, courtStyle: 'daoguan',
      bays: 5, bayW: 2.5, depth: 5.0, floorH: 3.4, baseH: 0.7, steps: 3,
      railing: true, wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.1, slope: 0.5, roofType: 'gableHip', ridgeStyle: 'plain',
      dougong: true, dgScale: 0.85, plaque: true, censer: true, lanterns: true,
      winPattern: 'straight', doorW: 2.0, doorH: 2.8,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [{ kind: 'altar', x: 0, z: -1.4 }],
      env: { ground: 'stone', groundSize: 12, trees: ['pine', 'bamboo'], rocks: 1, pond: null, banners: 0, path: true, props: ['stonelamp'] }
    },
    wujin: {
      name: '五进四合院', type: 'courtyard', seed: 413,
      courtW: 18, courtD: 36, courtStyle: 'wujin',
      bays: 3, bayW: 2.6, depth: 5.0, floorH: 3.2, baseH: 0.5, steps: 3,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 0.9, slope: 0.5, roofType: 'gable', upturn: 0.2,
      winPattern: 'step', winW: 1.2, winH: 1.3, doorW: 1.9, doorH: 2.6,
      plaque: true, lanterns: true,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [{ kind: 'bed', x: -1.2, z: -1.6 }, { kind: 'table', x: 1.0, z: -1.2 }, { kind: 'screen', x: 0, z: -2.2 }],
      env: { ground: 'brick', groundSize: 10, trees: ['bamboo', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    langyuan: {
      name: '廊院式祠庙', type: 'courtyard', seed: 414,
      courtW: 20, courtD: 18, courtStyle: 'langyuan',
      bays: 5, bayW: 2.6, depth: 4.6, floorH: 3.4, baseH: 0.5, steps: 3,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 1.0, slope: 0.48, roofType: 'gableHip',
      dougong: true, dgScale: 0.8, plaque: true,
      winPattern: 'straight', doorW: 2.0, doorH: 2.8,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [{ kind: 'altar', x: 0, z: -1.4 }],
      env: { ground: 'stone', groundSize: 10, trees: ['pine', 'bamboo'], rocks: 1, pond: null, banners: 0, path: true, props: ['stele'] }
    },
    shifang: {
      name: '石舫·旱船三段', type: 'fang', seed: 415,
      fangStyle: 'shifang', span: 13, bridgeW: 3.6, floorH: 2.8, baseH: 0.4,
      colMat: 'wood', tileColor: 'grey', eave: 0.5, slope: 0.45, upturn: 0.2,
      lanterns: true,
      env: { ground: 'soil', groundSize: 12, trees: ['willow'], rocks: 0, pond: { x: 0, z: 0, w: 12, d: 6 }, banners: 0, path: false },
      render: { palette: 'qingya', style: 'ink', styleAmount: 0.7 }
    },
    jiafu: {
      name: '贾府·前府后园', type: 'courtyard', seed: 416,
      courtW: 24, courtD: 40, courtStyle: 'jiafu',
      bays: 3, bayW: 2.7, depth: 4.6, floorH: 3.3, baseH: 0.55, steps: 3,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 1.0, slope: 0.5, roofType: 'gableHip', upturn: 0.25,
      dougong: true, dgScale: 0.8, plaque: true, lanterns: true,
      winPattern: 'step', doorW: 2.0, doorH: 2.7,
      cut: { front: true, right: true, left: false, back: false, roof: false },
      interior: [{ kind: 'table', x: 0, z: 0.6 }, { kind: 'screen', x: 0, z: -1.6 }],
      env: { ground: 'grass', groundSize: 12, trees: ['willow', 'plum', 'maple'], rocks: 2, pond: null, banners: 0, path: true, props: ['penjing', 'stonelamp'] }
    },
    shuixie: {
      name: '水榭', type: 'xie', seed: 116,
      bays: 3, bayW: 2.8, depth: 6.4, floorH: 3.0, baseH: 0.8, steps: 2,
      colMat: 'wood', tileColor: 'grey', eave: 0.9, slope: 0.5, upturn: 0.45,
      roofType: 'roll', plaque: true, lanterns: true,
      env: { ground: 'grass', groundSize: 12, trees: ['willow', 'bamboo'], rocks: 2, pond: { x: 0, z: 0, w: 9, d: 5 }, banners: 0, path: true }
    },
    huafang: {
      name: '画舫', type: 'fang', seed: 117,
      span: 12, bridgeW: 3.4, floorH: 2.8, baseH: 0.4,
      colMat: 'wood', tileColor: 'grey', eave: 0.5, slope: 0.45,
      lanterns: true,
      env: { ground: 'soil', groundSize: 10, trees: ['willow'], rocks: 0, pond: null, banners: 0, path: false },
      render: { palette: 'qingya', style: 'ink', styleAmount: 0.7 }
    },
    chongge: {
      name: '重檐楼阁', type: 'ge', seed: 118,
      bays: 3, bayW: 3.0, depth: 6.0, floors: 2, floorH: 3.0, baseH: 0.8, steps: 3,
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 0.9, slope: 0.5, upturn: 0.42, roofType: 'gableHip',
      dougong: true, dgScale: 0.85, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 13, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    tengwang: {
      name: '滕王阁', type: 'ge', seed: 134,
      bays: 5, bayW: 3.2, depth: 7.0, floors: 3, floorH: 3.4, baseH: 1.1, steps: 4,
      railing: true, railStyle: 'wood', wallMat: 'zhu', colMat: 'timber',
      tileColor: 'celadon', eave: 1.15, slope: 0.42, upturn: 0.5, roofType: 'gableHip',
      dougong: true, dgScale: 1.0, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 18, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 2, path: true }
    },
    que: {
      name: '汉阙', type: 'que', seed: 119,
      width: 12, wallH: 6.0, floorH: 3.0, baseH: 0.6,
      wallMat: 'brick', tileColor: 'grey', eave: 0.7, slope: 0.42, upturn: 0.5,
      plaque: true,
      env: { ground: 'stone', groundSize: 12, trees: ['pine'], rocks: 1, pond: null, banners: 2, path: true }
    },
    changlang: {
      name: '长廊', type: 'corridor', seed: 120,
      span: 16, bridgeW: 2.8, floorH: 2.6, baseH: 0.3,
      colMat: 'wood', tileColor: 'grey', eave: 0.5, slope: 0.4, roofType: 'roll',
      lanterns: true,
      env: { ground: 'soil', groundSize: 10, trees: ['bamboo', 'willow'], rocks: 0, pond: { x: 0, z: 5.6, w: 6, d: 2.4 }, banners: 0, path: false }
    },
    luntai: {
      name: '露台', type: 'tai', seed: 121,
      width: 9, depth: 7, baseH: 1.4, steps: 4, railing: true, railStyle: 'marble',
      pedestal: 'xumizuo', tileColor: 'grey', censer: true, lanterns: true, plaque: true,
      env: { ground: 'marble', groundSize: 13, trees: ['pine', 'pine'], rocks: 0, pond: null, banners: 2, path: true }
    },
    juanpeng: {
      name: '卷棚轩', type: 'hall', seed: 122,
      bays: 3, bayW: 3.4, depth: 7.2, floors: 1, floorH: 3.4, baseH: 0.5, steps: 2,
      wallMat: 'plaster', colMat: 'wood', tileColor: 'grey',
      eave: 0.9, slope: 0.42, roofType: 'roll', xuanYu: true, windDuo: true,
      winPattern: 'ice', winW: 1.3, winH: 1.3, doorW: 1.8, doorH: 2.5,
      plaque: true, lanterns: true, ceiling: 'flat',
      interior: [{ kind: 'table', x: 0, z: 0 }, { kind: 'screen', x: 0, z: -2 }, { kind: 'shelf', x: 2.2, z: -1.6 }],
      env: { ground: 'stone', groundSize: 11, trees: ['bamboo', 'plum'], rocks: 0, pond: null, banners: 0, path: true, props: ['penjing'] }
    },
    shizijia: {
      name: '十字歇山阁', type: 'ge', seed: 123,
      bays: 3, bayW: 3.2, depth: 6.4, floors: 2, floorH: 3.0, baseH: 0.9, steps: 3,
      wallMat: 'zhu', colMat: 'timber', tileColor: 'yellow',
      eave: 1.0, slope: 0.52, upturn: 0.5, roofType: 'cross',
      dougong: true, dgScale: 0.9, dgStyle: 'full', ridgeStyle: 'ornate', beasts: 3,
      plaque: true, lanterns: true,
      env: { ground: 'marble', groundSize: 13, trees: ['pine'], rocks: 0, pond: null, banners: 0, path: true }
    },
    luding: {
      name: '盝顶殿', type: 'hall', seed: 124,
      bays: 5, bayW: 3.0, depth: 8.4, floors: 1, floorH: 3.8, baseH: 0.9, steps: 3,
      railing: true, wallMat: 'zhu', colMat: 'timber', tileColor: 'blue',
      eave: 1.1, slope: 0.5, roofType: 'lu', finial: true, ridgeStyle: 'ornate', beasts: 0,
      dougong: true, dgScale: 0.9, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true, ceiling: 'caisson',
      interior: [{ kind: 'altar', x: 0, z: -1.6 }, { kind: 'screen', x: 0, z: -3.0 }, { kind: 'table', x: 0, z: 0.6 }],
      env: { ground: 'marble', groundSize: 13, trees: ['pine', 'pine'], rocks: 0, pond: null, banners: 2, path: true }
    },
    shuimo: {
      name: '水墨手绘', type: 'hall', seed: 125,
      bays: 3, bayW: 3.2, depth: 7.4, floors: 1, floorH: 3.4, baseH: 0.6, steps: 3,
      wallMat: 'plaster', colMat: 'timber', tileColor: 'grey',
      eave: 1.1, slope: 0.5, upturn: 0.4, roofType: 'gableHip',
      queti: true, plaque: true, lanterns: true, couplet: true, ceiling: 'flat',
      interior: [{ kind: 'table', x: 0, z: -0.4 }, { kind: 'screen', x: 0, z: -2.2 }],
      env: { ground: 'stone', groundSize: 9, trees: ['plum', 'bamboo'], rocks: 1, pond: null, banners: 0, path: true },
      render: { palette: 'moxi', style: 'ink', styleAmount: 0.85 }
    },
    subi: {
      name: '枯笔速写', type: 'house', seed: 126,
      bays: 3, bayW: 2.8, depth: 5.6, floors: 2, floorH: 2.8, baseH: 0.35, steps: 2,
      wallMat: 'plaster', colMat: 'wood', tileColor: 'clay',
      eave: 0.6, slope: 0.45, upturn: 0.2, roofType: 'gable',
      winPattern: 'straight', doorW: 1.4, doorH: 2.2, lanterns: true,
      interior: [{ kind: 'table', x: 0, z: 0.4 }, { kind: 'stool', x: 0.9, z: 0.4 }],
      env: { ground: 'soil', groundSize: 10, trees: ['willow'], rocks: 1, pond: null, banners: 0, path: true },
      render: { palette: 'zheshi', style: 'sketch', styleAmount: 0.9 }
    },
    /* ---------------- 民居演变谱系：穴居 → 半坡 → 汉 → 唐 → 宋（明清由江南 / 徽州承担） ---------------- */
    kuXue: {
      name: '穴居·半地穴', type: 'cave', seed: 201,
      radius: 2.0, pitDepth: 0.8, rimH: 0.55,
      wallMat: 'soil', colMat: 'wood',
      tileColor: 'thatch', eave: 0.35, slope: 0.7, upturn: 0.02,
      plaque: false, lanterns: false,
      interior: [{ kind: 'firepit', x: 0, z: 0 }, { kind: 'mat', x: 0.85, z: -0.7 }],
      env: { ground: 'soil', groundSize: 11, trees: ['willow'], rocks: 1, pond: null, banners: 0, path: false }
    },
    banPo: {
      name: '半坡聚落', type: 'house', seed: 202,
      bays: 2, bayW: 2.3, depth: 4.0, floors: 1, floorH: 2.1,
      baseH: 0.22, steps: 1, pedestal: 'plain', wallMat: 'soil', colMat: 'wood',
      tileColor: 'thatch', eave: 0.6, slope: 0.62, upturn: 0.05,
      roofType: 'gable', winPattern: 'straight', winW: 0.9, winH: 0.9,
      doorStyle: 'panel', doorW: 1.3, doorH: 1.8,
      ridgeStyle: 'none',
      dougong: false, queti: false, plaque: false, lanterns: false,
      interior: [{ kind: 'table', x: 0, z: 0.3 }, { kind: 'stool', x: 0.9, z: 0.3 }],
      env: { ground: 'soil', groundSize: 11, trees: ['willow', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    hanMin: {
      name: '汉式民居', type: 'house', seed: 203, era: 'han',
      bays: 3, bayW: 2.6, depth: 5.0, floors: 1, floorH: 2.3,
      baseH: 0.35, steps: 2, pedestal: 'plain', wallMat: 'soil', colMat: 'wood',
      tileColor: 'clay', eave: 0.75, slope: 0.55, upturn: 0.02,
      roofType: 'gable', winPattern: 'straight', winW: 1.1, winH: 1.2,
      doorStyle: 'panel', doorW: 1.6, doorH: 2.1,
      ridgeStyle: 'plain', beasts: 0, finial: false,
      dougong: false, queti: false, plaque: false, lanterns: false,
      interior: [{ kind: 'table', x: 0, z: 0.4 }, { kind: 'stool', x: 0.9, z: 0.4 }],
      env: { ground: 'soil', groundSize: 12, trees: ['pine'], rocks: 1, pond: null, banners: 0, path: true }
    },
    tangMin: {
      name: '唐式民居', type: 'house', seed: 204, era: 'tang',
      bays: 3, bayW: 3.0, depth: 5.6, floors: 1, floorH: 2.8,
      baseH: 0.5, steps: 2, pedestal: 'plain', wallMat: 'plaster', colMat: 'timber',
      colR: 0.24,
      tileColor: 'grey', eave: 1.0, slope: 0.42, upturn: 0.08,
      roofType: 'hip', winPattern: 'straight', winW: 1.2, winH: 1.4,
      doorStyle: 'panel', doorW: 1.9, doorH: 2.5,
      ridgeStyle: 'plain', beasts: 0, finial: false,
      dougong: false, queti: false, plaque: false, lanterns: false,
      interior: [{ kind: 'table', x: 0, z: 0.6 }, { kind: 'screen', x: 0, z: -1.6 }],
      env: { ground: 'stone', groundSize: 13, trees: ['pine', 'pine'], rocks: 1, pond: null, banners: 0, path: true }
    },
    songMin: {
      name: '宋式民居', type: 'house', seed: 205, era: 'song',
      bays: 3, bayW: 2.8, depth: 5.2, floors: 1, floorH: 2.9,
      baseH: 0.4, steps: 2, pedestal: 'plain', wallMat: 'plaster', colMat: 'wood',
      tileColor: 'grey', eave: 0.9, slope: 0.55, upturn: 0.18,
      roofType: 'gableHip', winPattern: 'step', winW: 1.2, winH: 1.3,
      doorStyle: 'leaf', doorW: 1.7, doorH: 2.5, doorLeaves: 4,
      dougong: true, dgScale: 0.7, dgStyle: 'simple',
      ridgeStyle: 'plain', beasts: 0, finial: false,
      plaque: false, lanterns: false,
      interior: [{ kind: 'table', x: 0, z: 0.4 }, { kind: 'stool', x: 0.95, z: 0.4 }, { kind: 'shelf', x: -2.2, z: -1.4 }],
      env: { ground: 'stone', groundSize: 12, trees: ['plum', 'bamboo'], rocks: 1, pond: null, banners: 0, path: true }
    },
    /* ---------------- 阶段② 塔与楼阁：文物实例 ---------------- */
    leifeng: {
      name: '雷峰塔', type: 'pagoda', seed: 301,
      tiers: 5, radius: 3.26, floorH: 1.7, baseH: 0.9, steps: 3,
      floorHList: [1.85, 1.7, 1.6, 1.5, 1.42],
      shrinkList: [0.94, 0.92, 0.9, 0.88],
      eaveList: [0.85, 0.8, 0.75, 0.7, 0.65],
      dgList: [2, 2, 2, 1, 1],
      pingzuo: true, fujie: true, fujieR: 0.67,
      colMat: 'timber', tileColor: 'grey', slope: 0.5, upturn: 0.35, finial: true,
      plaque: false,
      env: { ground: 'stone', groundSize: 16, trees: ['pine', 'pine', 'gingko'], rocks: 2, pond: null, banners: 2, path: true }
    },
    yingxian: {
      name: '应县木塔', type: 'pagoda', seed: 302,
      tiers: 5, radius: 4.0, floorH: 1.8, baseH: 0.9, steps: 3, railing: true, railStyle: 'marble',
      floorHList: [2.0, 1.9, 1.8, 1.7, 1.6],
      shrinkList: [0.92, 0.9, 0.9, 0.88],
      eaveList: [1.0, 0.95, 0.9, 0.85, 0.8],
      dgList: [2, 2, 2, 2, 1],
      pingzuo: true, pingzuoStyle: 'wood', fujie: true, fujieR: 1.7,
      pedestal: 'xumizuo', colMat: 'timber', tileColor: 'grey', slope: 0.52, upturn: 0.35, finial: true,
      plaque: true,
      env: { ground: 'stone', groundSize: 18, trees: ['pine', 'pine'], rocks: 2, pond: null, banners: 2, path: true }
    },
    wenchang: {
      name: '文昌阁·城关', type: 'ge', seed: 303,
      terraceGate: true, width: 9.4, depthTower: 6.8, wallH: 4.4, gateW: 2.6, gateH: 3.2,
      bays: 3, bayW: 2.8, depth: 4.6, floors: 2, floorH: 3.0, baseH: 0.4, steps: 3,
      railing: true, railStyle: 'marble', wallMat: 'zhu', colMat: 'timber',
      tileColor: 'yellow', trimColor: 'green', eave: 1.0, slope: 0.5, upturn: 0.45, roofType: 'cross',
      dougong: true, dgScale: 0.85, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true,
      env: { ground: 'marble', groundSize: 15, trees: ['pine'], rocks: 0, pond: null, banners: 0, path: true }
    },
    feiyun: {
      name: '飞云楼', type: 'ge', seed: 304,
      bays: 5, bayW: 2.3, depth: 11.5, floors: 3, tiers: 4, floorH: 3.0, baseH: 0.9, steps: 3,
      floorHList: [3.25, 3.05, 2.85], shrinkList: [0.96, 0.93, 0.9], eaveList: [1.0, 0.9, 0.8], dgList: [2, 2, 2],
      pingzuo: true, pingzuoStyle: 'wood', baoxia: true, baoxiaD: 1.25, baoxiaW: 0.42,
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.0, slope: 0.5, upturn: 0.45, roofType: 'cross',
      dougong: true, dgScale: 0.7, dgStyle: 'full', queti: true,
      plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 17, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    /* ---------------- 阶段② 概念参考（仅标题 / 关键词，不设虚构尺寸） ---------------- */
    fanlou: {
      name: '樊楼·水上十字楼', type: 'ge', seed: 305,
      bays: 3, bayW: 3.4, depth: 7.6, floors: 3, floorH: 3.5, baseH: 1.0, steps: 4,
      pingzuo: true, baoxia: true, baoxiaD: 1.5, baoxiaW: 0.52,
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'celadon', eave: 1.25, slope: 0.55, upturn: 0.5, roofType: 'cross',
      dougong: true, dgScale: 0.95, dgStyle: 'full', queti: true,
      plaque: true, lanterns: true, stilts: true,
      env: { ground: 'water', groundSize: 24, trees: ['willow', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    fanhuaju: {
      name: '繁花居·三层十字楼', type: 'ge', seed: 306,
      bays: 3, bayW: 3.0, depth: 6.6, floors: 3, floorH: 3.2, baseH: 0.7, steps: 3,
      pingzuo: true, baoxia: true, baoxiaD: 1.2, baoxiaW: 0.5,
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'celadon', eave: 1.1, slope: 0.5, upturn: 0.45, roofType: 'cross',
      dougong: true, dgScale: 0.85, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 15, trees: ['bamboo', 'plum', 'gingko'], rocks: 2, pond: null, banners: 0, path: true }
    },
    shilou: {
      name: '时楼·重檐平座', type: 'ge', seed: 307,
      bays: 3, bayW: 3.2, depth: 6.4, floors: 2, floorH: 3.4, baseH: 0.8, steps: 3,
      pingzuo: true, baoxia: true, baoxiaD: 1.15, baoxiaW: 0.44, trimColor: 'green',
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'grey', eave: 1.15, slope: 0.5, upturn: 0.45, roofType: 'cross',
      dougong: true, dgScale: 0.85, dgStyle: 'full', dgList: [2, 2],
      plaque: true, lanterns: true,
      env: { ground: 'stone', groundSize: 14, trees: ['pine', 'plum'], rocks: 1, pond: null, banners: 0, path: true }
    },
    zuihuayin: {
      name: '醉花阴·临水楼台', type: 'ge', seed: 308,
      bays: 3, bayW: 3.0, depth: 6.2, floors: 2, floorH: 3.2, baseH: 0.9, steps: 3,
      pingzuo: true, baoxia: true, baoxiaD: 1.1, baoxiaW: 0.46,
      railing: true, railStyle: 'wood', wallMat: 'plaster', colMat: 'timber',
      tileColor: 'celadon', eave: 1.0, slope: 0.5, upturn: 0.5, roofType: 'cross',
      dougong: true, dgScale: 0.8, dgStyle: 'mid', queti: true,
      plaque: true, lanterns: true, stilts: true,
      env: { ground: 'water', groundSize: 22, trees: ['willow', 'bamboo'], rocks: 1, pond: null, banners: 0, path: true }
    },
    /* ---------------- 阶段③ 城：都城实例 ---------------- */
    tangchangan: {
      name: '城 · 唐长安', type: 'city', seed: 401,
      cityW: 400, cityD: 356, realW: 9721, realD: 8651, scale: 24.3,
      wallH: 4.0, wallBaseW: 2.0, wallTopW: 1.0, merlon: true, parapet: true,
      gateCount: 5, gateW: 2.0, gateH: 3.4, gateTower: true, gateSide: 'four',
      bastionN: 13, bastionProj: 1.3, cornerTower: true,
      blockW: 0, blockD: 0, streetW: 1.9, blocksX: 12, blocksZ: 10, blockWallH: 1.0,
      axisHalls: 3, axisPalace: true, palaceCorner: 'north',
      palaceW: 78, palaceD: 52, innerW: 150, innerD: 104,
      moatW: 3.5, moatD: 0.8, moatBridge: true, cityShape: 'rect',
      colMat: 'timber', wallMat: 'brick', tileColor: 'grey', eave: 0.9, slope: 0.5, upturn: 0.3,
      env: { showGround: false, ground: 'soil', groundSize: 13, trees: [], rocks: 0, pond: null, banners: 0, props: [], path: false },
      render: { ppm: 12, pitch: 48 }
    },
    luoyang: {
      name: '城 · 洛阳', type: 'city', seed: 402,
      cityW: 300, northW: 216, cityD: 299, realW: 7312, realD: 7290, scale: 24.4,
      wallH: 4.0, wallBaseW: 2.0, wallTopW: 1.0, merlon: true, parapet: true,
      gateCount: 3, gateW: 2.0, gateH: 3.4, gateTower: true, gateSide: 'four',
      bastionN: 10, bastionProj: 1.3, cornerTower: true,
      blockW: 0, blockD: 0, streetW: 1.6, blocksX: 12, blocksZ: 11, blockWallH: 1.0,
      axisHalls: 3, axisPalace: true, palaceCorner: 'corner',
      palaceW: 60, palaceD: 52, innerW: 0, innerD: 0,
      moatW: 3.5, moatD: 0.8, moatBridge: true, cityShape: 'trapezoid',
      colMat: 'timber', wallMat: 'brick', tileColor: 'grey', eave: 0.9, slope: 0.5, upturn: 0.3,
      env: { showGround: false, ground: 'soil', groundSize: 13, trees: [], rocks: 0, pond: null, banners: 0, props: [], path: false },
      render: { ppm: 12, pitch: 48 }
    },
    beijing: {
      name: '城 · 明清北京', type: 'city', seed: 403,
      cityW: 300, cityD: 300, realW: 6200, realD: 6200, scale: 20.7,
      wallH: 5.5, wallBaseW: 3.4, wallTopW: 1.7, merlon: true, parapet: true,
      gateCount: 3, gateW: 2.4, gateH: 3.8, gateTower: true, gateSide: 'four',
      bastionN: 8, bastionProj: 1.7, cornerTower: true,
      blockW: 0, blockD: 0, streetW: 2.0, blocksX: 9, blocksZ: 9, blockWallH: 1.1,
      axisHalls: 3, axisPalace: true, palaceCorner: 'center',
      palaceW: 70, palaceD: 84, innerW: 0, innerD: 0,
      moatW: 2.6, moatD: 1.0, moatBridge: true, cityShape: 'rect',
      wengcheng: true, wengD: 13, wengW: 22, wengOffset: 0.35, arrowTower: true,
      drawbridge: true, bridgeUp: false,
      colMat: 'timber', wallMat: 'brick', tileColor: 'grey', eave: 1.0, slope: 0.55, upturn: 0.35,
      env: { showGround: false, ground: 'soil', groundSize: 13, trees: [], rocks: 0, pond: null, banners: 0, props: [], path: false },
      render: { ppm: 12, pitch: 48 }
    },
    gugong: {
      name: '城 · 紫禁城', type: 'city', seed: 404,
      cityW: 120, cityD: 153, realW: 753, realD: 961, scale: 6.28,
      wallH: 3.2, wallBaseW: 1.37, wallTopW: 1.06, merlon: true, parapet: true,
      gateCount: 3, gateW: 1.8, gateH: 3.0, gateTower: true, gateSide: 'four',
      bastionN: 0, bastionProj: 1.0, cornerTower: true,
      blockW: 0, blockD: 0, streetW: 1.6, blocksX: 2, blocksZ: 2, blockWallH: 1.0,
      axisHalls: 3, axisPalace: true, palaceCorner: 'center',
      palaceW: 96, palaceD: 130, innerW: 0, innerD: 0,
      moatW: 8.3, moatD: 0.96, moatBridge: true, cityShape: 'rect',
      colMat: 'timber', wallMat: 'zhu', tileColor: 'yellow', eave: 1.0, slope: 0.55, upturn: 0.4,
      env: { showGround: false, ground: 'marble', groundSize: 13, trees: [], rocks: 0, pond: null, banners: 0, props: [], path: false },
      render: { ppm: 14, pitch: 48 }
    }
  };

  /* 古建页只出单体建筑；“城 · 唐长安 / 洛阳 / 明清北京 / 紫禁城”四座城的配方
     已迁到城池工坊（js/gf-city.js 的 PRESETS），这里不再进古建的配方按钮，
     数据仍保留在本文件里，供 type:'city' 的老配方载入时兼容。 */
  GF.presetList = Object.keys(PRESETS)
    .filter((k) => PRESETS[k].type !== 'city')
    .map((k) => ({ key: k, name: PRESETS[k].name }));
  GF.getPreset = function (key) {
    const p = PRESETS[key] || PRESETS.jiangnan;
    return GF.normalize(Object.assign(clone(p), { preset: key }));
  };

  /* ------------------------------ 随机 ------------------------------ */
  GF.randomRecipe = function (seed) {
    const rng = new GF.RNG(seed || Date.now());
    const types = ['hall', 'hall', 'house', 'house', 'pavilion', 'pagoda', 'archway', 'gate', 'courtyard', 'bridge'];
    const type = rng.pick(types);
    const paletteKeys = GF.PALETTE_KEYS;
    const base = GF.getPreset(
      type === 'house' ? (rng.chance(0.5) ? 'jiangnan' : 'huizhou')
        : type === 'pavilion' ? 'ting'
        : type === 'pagoda' ? 'ta'
        : type === 'archway' ? 'paifang'
        : type === 'gate' ? 'chenglou'
        : type === 'courtyard' ? 'siheyuan'
        : type === 'bridge' ? 'langqiao'
        : (rng.chance(0.45) ? 'qing' : rng.chance(0.5) ? 'tang' : 'xieshan')
    );
    base.seed = seed || Math.floor(rng.next() * 1e9);
    base.bays = rng.pick([1, 3, 3, 5, 5, 7]);
    base.bayW = rng.range(2.4, 4.2);
    base.depth = rng.range(4.5, 11);
    base.floors = rng.pick([1, 1, 2, 2, 3]);
    base.floorH = rng.range(2.8, 4.4);
    base.baseH = rng.pick([0.3, 0.5, 0.8, 1.0, 1.2]);
    base.railing = rng.chance(0.45);
    base.steps = rng.int(1, 5);
    base.eave = rng.range(0.6, 1.5);
    base.slope = rng.range(0.4, 0.7);
    base.upturn = rng.range(0.18, 0.5);
    base.tileColor = rng.pick(['grey', 'grey', 'grey', 'yellow', 'celadon', 'blue', 'clay']);
    base.roofType = rng.pick(['hip', 'gableHip', 'gable', 'gableHip', 'hip']);
    base.ridgeStyle = rng.pick(['plain', 'plain', 'ornate']);
    base.beasts = base.ridgeStyle === 'ornate' ? rng.int(1, 5) : 0;
    base.dougong = rng.chance(0.6);
    base.dgScale = rng.range(0.6, 1.2);
    base.queti = rng.chance(0.5);
    base.winPattern = rng.pick(['step', 'straight', 'ice', 'lantern', 'wanzi']);
    base.doorStyle = rng.chance(0.4) ? 'panel' : 'leaf';
    base.wallMat = rng.pick(['plaster', 'plaster', 'brick', 'zhu', 'wood']);
    base.colMat = rng.pick(['timber', 'timber', 'wood']);
    base.plaque = rng.chance(0.6);
    base.lanterns = rng.chance(0.5);
    base.lions = rng.chance(0.35);
    base.censer = rng.chance(0.3);
    base.horseWall = type === 'house' ? rng.chance(0.4) : false;
    base.tiers = rng.chance(0.25) ? 2 : 1;
    base.render.palette = rng.pick(paletteKeys);
    base.render.ppm = rng.int(16, 26);
    base.env.ground = rng.pick(['stone', 'stone', 'brick', 'grass', 'soil']);
    base.env.trees = [rng.pick(['pine', 'plum', 'bamboo', 'willow', 'gingko', 'leaf'])];
    if (rng.chance(0.5)) base.env.trees.push(rng.pick(['pine', 'plum', 'bamboo', 'gingko']));
    base.env.rocks = rng.int(0, 3);
    if (rng.chance(0.4)) base.env.pond = { x: rng.range(4, 6), z: rng.range(3, 5), w: rng.range(2.6, 4), d: rng.range(2, 3) };
    base.env.banners = rng.chance(0.3) ? 2 : 0;
    base.interior = [
      { kind: 'table', x: 0, z: 0 },
      { kind: rng.pick(['screen', 'shelf', 'bed']), x: rng.range(-2, 2), z: -1.8 }
    ];
    base.name = '随机国风';
    return GF.normalize(base);
  };
})(typeof window !== 'undefined' ? window : globalThis);







