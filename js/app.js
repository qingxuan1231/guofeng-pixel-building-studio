/* ============================================================================
 * 国风古建像素工坊 · 界面与交互
 * ==========================================================================*/
(function () {
  'use strict';
  const GF = window.GF;

  const state = {
    recipe: GF.getPreset('siheyuan'),
    mesh: null,
    frame: null,
    zoom: 2,
    panX: 0,
    panY: 0,
    view: 'all',
    refit: true,
    playing: false,
    moves: [],
    moveMode: false,
    busy: false
  };

  const $ = (s, el) => (el || document).querySelector(s);
  const canvas = $('#view');
  const ctx = canvas.getContext('2d');
  const wrap = $('#canvasWrap');

  /* 渲染内核：GPU（WebGL2 硬件光栅） / CPU（软件光栅）。选择记在 localStorage，两页共用。 */
  state.gpu = (function () {
    let v = null;
    try { v = localStorage.getItem('gf.renderMode'); } catch (e) {}
    if (v === 'cpu') return false;
    if (v === 'gpu') return true;
    return GF.gpuAvailable ? GF.gpuAvailable() : false;
  })();

  function paintMode() {
    const b = $('#btnMode');
    if (!b) return;
    const ok = GF.gpuAvailable ? GF.gpuAvailable() : false;
    if (!ok) state.gpu = false;
    b.textContent = state.gpu ? 'GPU' : 'CPU';
    b.classList.toggle('ghost', !state.gpu);
    b.title = !ok
      ? '当前环境不支持 WebGL2，只能用 CPU'
      : state.gpu
        ? '当前：GPU 硬件光栅（只用于预览，导出仍走 CPU 全精度）；点一下切到 CPU'
        : '当前：CPU 软件光栅；点一下切到 GPU';
  }

  /* ------------------------------ 路径读写 ------------------------------ */
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  /* ------------------------------ 控件定义 ------------------------------ */
  const TYPES = [
    { v: 'hall', t: '殿 / 堂' },
    { v: 'house', t: '民居' },
    { v: 'courtyard', t: '院落（宅院 / 园林 / 寺院）' },
    { v: 'pavilion', t: '亭' },
    { v: 'xie', t: '水榭' },
    { v: 'fang', t: '画舫' },
    { v: 'ge', t: '楼阁（带平座）' },
    { v: 'pagoda', t: '塔' },
    { v: 'archway', t: '牌坊' },
    { v: 'gate', t: '城门楼' },
    { v: 'que', t: '阙' },
    { v: 'corridor', t: '长廊' },
    { v: 'tai', t: '露台' },
    { v: 'bridge', t: '廊桥' },
  ];

  const WALL_MATS = [
    { v: 'plaster', t: '白粉墙' }, { v: 'brick', t: '青砖墙' },
    { v: 'zhu', t: '朱红墙' }, { v: 'wood', t: '木板壁' }, { v: 'stone', t: '石墙' }
  ];
  const COL_MATS = [
    { v: 'timber', t: '朱漆柱' }, { v: 'wood', t: '素木柱' }, { v: 'stone', t: '石柱' }
  ];
  const TILE_COLORS = [
    { v: 'grey', t: '青瓦' }, { v: 'clay', t: '陶瓦' }, { v: 'yellow', t: '黄琉璃' },
    { v: 'celadon', t: '绿琉璃' }, { v: 'blue', t: '孔雀蓝琉璃' }
  ];
  const ROOF_TYPES = [
    { v: 'gable', t: '悬山 / 硬山' }, { v: 'gableHip', t: '歇山' },
    { v: 'hip', t: '庑殿' }, { v: 'pyramid', t: '攒尖' },
    { v: 'roll', t: '卷棚（元宝脊）' }, { v: 'cross', t: '十字歇山' },
    { v: 'lu', t: '盝顶' }
  ];
  const WINS = [
    { v: 'step', t: '步步锦' }, { v: 'straight', t: '直棂' },
    { v: 'ice', t: '冰裂纹' }, { v: 'lantern', t: '灯笼框' }, { v: 'wanzi', t: '万字纹' },
    { v: 'haitang', t: '海棠纹' }, { v: 'liujiao', t: '六角龟背锦' }
  ];
  const GROUNDS = [
    { v: 'stone', t: '石板地' }, { v: 'brick', t: '砖地' },
    { v: 'soil', t: '夯土' }, { v: 'grass', t: '草地' }, { v: 'marble', t: '汉白玉' }
  ];
  // 场地类型：不等于一定是“陆地”，可以整片湖面、湖畔、两岸水道
  const SCENES = [
    { v: 'plain', t: '平地（铺装）' }, { v: 'lake', t: '整片湖面' },
    { v: 'shore', t: '湖畔（单岸）' }, { v: 'banks', t: '两岸（水道）' }
  ];
  const SHADOW_DIRS = [
    { v: 0, t: '东' }, { v: 45, t: '东南' }, { v: 90, t: '南' },
    { v: 135, t: '西南' }, { v: 180, t: '西' }, { v: 225, t: '西北' },
    { v: 270, t: '北' }, { v: 315, t: '东北' }
  ];
  const TREES = [
    { v: 'pine', t: '松' }, { v: 'plum', t: '梅' }, { v: 'bamboo', t: '竹' },
    { v: 'willow', t: '柳' }, { v: 'gingko', t: '银杏' }, { v: 'leaf', t: '阔叶' },
    { v: 'banana', t: '芭蕉' }, { v: 'maple', t: '红枫' }
  ];
  const PALETTES = [
    { v: 'qingya', t: '清雅·白日' }, { v: 'dusk', t: '暮色·黄昏' },
    { v: 'night', t: '夜色·灯影' }, { v: 'snow', t: '雪霁·素裹' },
    { v: 'moxi', t: '水墨·宣纸' }, { v: 'zheshi', t: '赭石·双套印' },
    { v: 'qinglv', t: '青绿·绢本' }
  ];
  const PEDESTALS = [
    { v: 'xumizuo', t: '须弥座' }, { v: 'plain', t: '直台基（阶条石）' }, { v: 'stone', t: '毛石台' }
  ];
  const RAILS = [
    { v: 'marble', t: '石栏（望柱栏板）' }, { v: 'wood', t: '木寻杖栏杆' }, { v: 'beauty', t: '美人靠（吴王靠）' }
  ];
  const DG_STYLES = [
    { v: 'simple', t: '一斗三升' }, { v: 'mid', t: '五踩斗拱' }, { v: 'full', t: '七踩重拱' }
  ];
  const TRIM_COLORS = [
    { v: '', t: '不剪边' }, { v: 'gold', t: '黄琉璃剪边' }, { v: 'green', t: '绿琉璃剪边' },
    { v: 'blue', t: '孔雀蓝剪边' }, { v: 'grey', t: '青瓦剪边' }
  ];
  const STYLES = [
    { v: 'pixel', t: '像素硬边（原味）' }, { v: 'ink', t: '水墨手绘' },
    { v: 'sketch', t: '枯笔速写' }, { v: 'wash', t: '双色套印' },
    { v: 'gongbi', t: '工笔重彩' }, { v: 'woodcut', t: '木刻版画' },
    { v: 'rubbing', t: '金石拓片' }, { v: 'watercolor', t: '水彩晕染' }
  ];
  const COURT_STYLES = [
    { v: 'siheyuan', t: '四合院 / 宅院' }, { v: 'garden', t: '江南园林（叠山理水）' },
    { v: 'temple', t: '寺院（山门·钟鼓楼·大殿）' },
    { v: 'temple5', t: '寺·五进中轴' }, { v: 'daoguan', t: '道观（中路紧凑）' },
    { v: 'wujin', t: '五进四合院' }, { v: 'langyuan', t: '廊院式祠庙' },
    { v: 'jiafu', t: '贾府（前府后园）' }
  ];
  const FANG_STYLES = [
    { v: 'classic', t: '画舫（舱楼式）' }, { v: 'shifang', t: '石舫 / 旱船（三段）' }
  ];
  const CEILINGS = [
    { v: 'none', t: '无（露明）' }, { v: 'flat', t: '井口天花' }, { v: 'caisson', t: '藻井' }
  ];
  const PROPS = [
    { v: 'stonelamp', t: '石灯' }, { v: 'well', t: '井' }, { v: 'stele', t: '碑' },
    { v: 'bell', t: '钟' }, { v: 'drum', t: '鼓' }, { v: 'penjing', t: '盆景' },
    { v: 'tiema', t: '拴马桩' }, { v: 'qubridge', t: '曲桥' }
  ];

  // 有屋顶的形制 / 有墙有门窗的形制：用于控件的 only 显隐
  const ROOFED = ['hall', 'house', 'courtyard', 'ge', 'xie', 'fang', 'gate', 'que', 'pavilion', 'pagoda', 'archway', 'bridge', 'corridor'];
  const ROOF_ONLY = ['hall', 'house', 'ge', 'xie', 'gate', 'pavilion', 'pagoda'];
  const WALLED = ['hall', 'house', 'ge', 'courtyard', 'gate'];
  const BODY = ['hall', 'house', 'ge'];
  const RAILED = ['hall', 'house', 'ge', 'que', 'tai', 'xie', 'pagoda'];

  const GROUPS = [
    {
      title: '一 · 形制与尺度',
      items: [
        { path: 'type', label: '建筑类型', type: 'select', opts: TYPES },
        { path: 'bays', label: '面阔间数', type: 'range', min: 1, max: 7, step: 1, only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'bayW', label: '每间面阔', type: 'range', min: 2.0, max: 4.4, step: 0.1, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'depth', label: '进深', type: 'range', min: 3.6, max: 11, step: 0.2, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'floors', label: '层数', type: 'range', min: 1, max: 3, step: 1, only: ['hall', 'house', 'ge'] },
        { path: 'floorH', label: '层高', type: 'range', min: 2.4, max: 5.2, step: 0.1, unit: 'm', only: ['hall', 'house', 'courtyard', 'ge', 'xie', 'fang', 'archway', 'gate', 'pavilion', 'pagoda'] },
        { path: 'floorHList', label: '逐层层高（殿 / 阁）', type: 'series', countPath: 'floors', basePath: 'floorH', minCount: 1, maxCount: 3, min: 2.4, max: 5.2, step: 0.1, only: ['hall', 'house', 'ge', 'courtyard'] },
        { path: 'floorHList', label: '逐层层高（塔）', type: 'series', countPath: 'tiers', basePath: 'floorH', minCount: 3, maxCount: 9, min: 1.8, max: 4.0, step: 0.1, only: ['pagoda'] },
        { path: 'shrinkList', label: '逐层收分比', type: 'series', countPath: 'tiers', baseValue: 0.86, minCount: 3, maxCount: 9, min: 0.6, max: 1.05, step: 0.01, only: ['pagoda'] },
        { path: 'shrinkList', label: '逐层收分比（阁）', type: 'series', countPath: 'floors', baseValue: 0.92, minCount: 1, maxCount: 3, min: 0.6, max: 1.05, step: 0.01, only: ['ge'] },
        { path: 'baseH', label: '台基高', type: 'range', min: 0.2, max: 1.4, step: 0.05, unit: 'm', only: ['hall', 'house', 'courtyard', 'pavilion', 'pagoda', 'tai', 'xie', 'ge'] },
        { path: 'steps', label: '踏跺级数', type: 'range', min: 0, max: 6, step: 1, only: ['hall', 'house', 'courtyard', 'pavilion', 'pagoda', 'ge', 'tai'] },
        { path: 'railing', label: '台基栏杆', type: 'toggle', only: RAILED },
        { path: 'pedestal', label: '台基形制', type: 'select', opts: PEDESTALS, only: RAILED },
        { path: 'railStyle', label: '栏杆样式', type: 'select', opts: RAILS, only: RAILED.concat(['pavilion']), dep: { path: 'railing', equals: true, ignoreTypes: ['pavilion'] } },
        { path: 'radius', label: '亭 / 塔半径', type: 'range', min: 1.4, max: 4.0, step: 0.1, unit: 'm', only: ['pavilion', 'pagoda'] },
        { path: 'sides', label: '亭身面数', type: 'range', min: 4, max: 12, step: 2, only: ['pavilion'] },
        { path: 'tiers', label: '塔层数', type: 'range', min: 3, max: 9, step: 1, only: ['pagoda'] },
        { path: 'pingzuo', label: '层间平座（木围栏）', type: 'toggle', only: ['pagoda', 'ge'] },
        { path: 'pingzuoStyle', label: '平座栏杆', type: 'select', opts: [{ v: 'wood', t: '木栏杆' }, { v: 'marble', t: '石栏' }], only: ['pagoda', 'ge'], dep: { path: 'pingzuo', equals: true } },
        { path: 'fujie', label: '副阶周匝（底层围廊）', type: 'toggle', only: ['pagoda', 'hall', 'house'] },
        { path: 'fujieR', label: '副阶出挑', type: 'range', min: 0.8, max: 3.0, step: 0.1, only: ['pagoda', 'hall', 'house'], dep: { path: 'fujie', equals: true } },
        { path: 'eaveList', label: '逐层出檐', type: 'series', countPath: 'tiers', baseValue: 0.9, minCount: 3, maxCount: 9, min: 0.3, max: 2.0, step: 0.05, only: ['pagoda'] },
        { path: 'eaveList', label: '逐层出檐（阁）', type: 'series', countPath: 'floors', baseValue: 0.9, minCount: 1, maxCount: 3, min: 0.3, max: 2.0, step: 0.05, only: ['ge'] },
        { path: 'dgList', label: '逐层斗拱铺作', type: 'series', countPath: 'tiers', baseValue: 0, minCount: 3, maxCount: 9, min: 0, max: 3, step: 1, only: ['pagoda'] },
        { path: 'dgList', label: '逐层斗拱铺作（阁）', type: 'series', countPath: 'floors', baseValue: 0, minCount: 1, maxCount: 3, min: 0, max: 3, step: 1, only: ['ge'] },
        { path: 'baoxia', label: '抱厦（四出转角搭接）', type: 'toggle', only: ['ge'] },
        { path: 'terraceGate', label: '城关城台（券洞 + 台上阁）', type: 'toggle', only: ['ge'] },
        { path: 'huamen', label: '彩楼欢门（门楼意象）', type: 'toggle', only: ['ge'] },
        { path: 'courtStyle', label: '院落类型', type: 'select', opts: COURT_STYLES, only: ['courtyard'] },
        { path: 'courtW', label: '院落面宽', type: 'range', min: 14, max: 26, step: 0.5, unit: 'm', only: ['courtyard'] },
        { path: 'courtD', label: '院落进深', type: 'range', min: 14, max: 40, step: 0.5, unit: 'm', only: ['courtyard'] },
        { path: 'jin', label: '院落进数', type: 'range', min: 1, max: 5, step: 1, only: ['courtyard'] },
        { path: 'axisRaise', label: '轴线逐级抬高', type: 'toggle', only: ['courtyard'] },
        { path: 'fangStyle', label: '舫式', type: 'select', opts: FANG_STYLES, only: ['fang'] },
        { path: 'width', label: '城台 / 台面宽', type: 'range', min: 7, max: 18, step: 0.5, unit: 'm', only: ['gate', 'que', 'tai'] },
        { path: 'depth', label: '露台 / 画舫进深', type: 'range', min: 3, max: 12, step: 0.2, unit: 'm', only: ['tai', 'fang'] },
        { path: 'wallH', label: '城台高', type: 'range', min: 3.4, max: 8, step: 0.2, unit: 'm', only: ['gate', 'que'] },
        { path: 'span', label: '跨度 / 长度', type: 'range', min: 7, max: 20, step: 0.5, unit: 'm', only: ['bridge', 'fang', 'corridor'] }
      ]
    },
    {
      title: '二 · 屋面',
      items: [
        { path: 'roofType', label: '屋顶形制', type: 'select', opts: ROOF_TYPES, only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'tileColor', label: '瓦色', type: 'select', opts: TILE_COLORS, only: ['hall', 'house', 'courtyard', 'ge', 'xie', 'fang', 'gate', 'que', 'pavilion', 'pagoda', 'archway', 'corridor', 'bridge'] },
        { path: 'eave', label: '出檐', type: 'range', min: 0.5, max: 2.0, step: 0.05, unit: 'm', only: ROOF_ONLY },
        { path: 'slope', label: '举折坡度', type: 'range', min: 0.32, max: 0.8, step: 0.01, only: ROOF_ONLY },
        { path: 'upturn', label: '檐角起翘', type: 'range', min: 0, max: 0.7, step: 0.02, only: ROOF_ONLY },
        { path: 'ridgeStyle', label: '正脊', type: 'select', opts: [{ v: 'none', t: '无' }, { v: 'plain', t: '素脊' }, { v: 'ornate', t: '雕饰脊' }], only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'beasts', label: '脊兽数', type: 'range', min: 0, max: 5, step: 1, only: ['hall', 'house', 'ge'], dep: { path: 'ridgeStyle', notEquals: 'none' } },
        { path: 'tiers', label: '重檐层数', type: 'range', min: 1, max: 2, step: 1, only: ['hall'] },
        { path: 'finial', label: '宝顶', type: 'toggle', only: ['hall', 'house', 'ge', 'pavilion', 'pagoda'], dep: { path: 'roofType', notEquals: 'roll', ignoreTypes: ['pavilion', 'pagoda'] } },
        { path: 'trimColor', label: '檐口剪边', type: 'select', opts: TRIM_COLORS, only: ROOF_ONLY },
        { path: 'xuanYu', label: '悬鱼 · 惹草', type: 'toggle', only: ['house', 'ge', 'xie'], dep: { path: 'roofType', oneOf: ['gable', 'gableHip', 'roll', 'cross'] } },
        { path: 'windDuo', label: '檐角风铎', type: 'toggle', only: ['hall', 'house', 'ge', 'gate', 'pavilion', 'pagoda'] }
      ]
    },
    {
      title: '三 · 墙体与门窗',
      items: [
        { path: 'wallMat', label: '墙面材质', type: 'select', opts: WALL_MATS, only: WALLED },
        { path: 'colMat', label: '立柱材质', type: 'select', opts: COL_MATS, only: ['hall', 'house', 'courtyard', 'ge', 'xie', 'archway', 'gate', 'corridor', 'bridge', 'pavilion'] },
        { path: 'winPattern', label: '格心样式', type: 'select', opts: WINS, only: WALLED },
        { path: 'winW', label: '窗宽', type: 'range', min: 0.6, max: 2.4, step: 0.05, unit: 'm', only: WALLED },
        { path: 'winH', label: '窗高', type: 'range', min: 0.7, max: 2.6, step: 0.05, unit: 'm', only: WALLED },
        { path: 'doorStyle', label: '门式', type: 'select', opts: [{ v: 'leaf', t: '隔扇门' }, { v: 'panel', t: '板门' }], only: WALLED },
        { path: 'doorW', label: '门宽', type: 'range', min: 1.0, max: 3.0, step: 0.05, unit: 'm', only: WALLED },
        { path: 'doorH', label: '门高', type: 'range', min: 1.8, max: 3.6, step: 0.05, unit: 'm', only: WALLED },
        { path: 'dougong', label: '斗拱', type: 'toggle', only: BODY },
        { path: 'dgStyle', label: '斗拱铺作', type: 'select', opts: DG_STYLES, only: BODY, dep: { path: 'dougong', equals: true } },
        { path: 'dgEye', label: '栱眼壁', type: 'toggle', only: BODY, dep: { path: 'dougong', equals: true } },
        { path: 'queti', label: '雀替', type: 'toggle', only: BODY },
        { path: 'plaque', label: '匾额', type: 'toggle', only: ['hall', 'house', 'courtyard', 'ge', 'gate', 'que', 'xie', 'archway', 'tai', 'pavilion'] },
        { path: 'couplet', label: '楹联', type: 'toggle', only: ['hall', 'house'] },
        { path: 'menZan', label: '门簪', type: 'toggle', only: ['hall', 'house'] },
        { path: 'baogu', label: '抱鼓石', type: 'toggle', only: ['hall', 'house'] },
        { path: 'ceiling', label: '天花 / 藻井', type: 'select', opts: CEILINGS, only: ['hall', 'house', 'ge'], dep: { path: 'cut.roof', equals: true } },
        { path: 'lanterns', label: '灯笼', type: 'toggle', only: ['hall', 'house', 'tai', 'pavilion'] },
        { path: 'lions', label: '石狮', type: 'toggle', only: ['hall', 'house'] },
        { path: 'censer', label: '香炉', type: 'toggle', only: ['hall', 'house', 'tai'] },
        { path: 'horseWall', label: '马头墙', type: 'toggle', only: ['house'] }
      ]
    },
    {
      title: '四 · 剖切（室内外无缝）',
      items: [
        { path: 'cut.front', label: '隐藏前墙', type: 'toggle', only: WALLED },
        { path: 'cut.back', label: '隐藏后墙', type: 'toggle', only: WALLED },
        { path: 'cut.left', label: '隐藏左墙', type: 'toggle', only: WALLED },
        { path: 'cut.right', label: '隐藏右墙', type: 'toggle', only: WALLED },
        { path: 'cut.roof', label: '隐藏屋面', type: 'toggle', only: ROOFED }
      ]
    },
    {
      title: '五 · 环境与陈设',
      items: [
        { path: 'env.showGround', label: '显示场地', type: 'toggle' },
        { path: 'env.groundType', label: '场地类型', type: 'select', opts: SCENES, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.ground', label: '岸面材质', type: 'select', opts: GROUNDS, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.groundSize', label: '场地半径', type: 'range', min: 4, max: 16, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterW', label: '水面宽度', type: 'range', min: 3, max: 12, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterSide', label: '水面在', type: 'select', opts: [{ v: 'front', t: '前方' }, { v: 'back', t: '后方' }, { v: 'left', t: '左侧' }, { v: 'right', t: '右侧' }], dep: { path: 'env.showGround', equals: true } },
        { path: 'env.trees', label: '树木', type: 'multi', opts: TREES },
        { path: 'env.props', label: '陈设道具', type: 'multi', opts: PROPS },
        { path: 'env.rocks', label: '假山数量', type: 'range', min: 0, max: 4, step: 1 },
        { path: 'env.banners', label: '幡旗数量', type: 'range', min: 0, max: 4, step: 1 },
        { path: 'pondOn', label: '水池', type: 'toggle' },
        { path: 'env.path', label: '门前甬道', type: 'toggle' }
      ]
    },
    {
      title: '六 · 绘画风格',
      items: [
        { path: 'render.style', label: '画风', type: 'select', opts: STYLES },
        { path: 'render.styleAmount', label: '风格强度', type: 'range', min: 0, max: 1, step: 0.05, dep: { path: 'render.style', notEquals: 'pixel' } },
        { path: 'render.palette', label: '配色底子', type: 'select', opts: PALETTES }
      ]
    },
    {
      title: '七 · 城制',
      items: [
        { path: 'cityShape', label: '平面形制', type: 'select', opts: [{ v: 'rect', t: '矩形' }, { v: 'trapezoid', t: '梯形（南宽北窄）' }], only: ['city'] },
        { path: 'cityW', label: '城垣面宽', type: 'range', min: 80, max: 420, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'cityD', label: '城垣进深', type: 'range', min: 80, max: 400, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'northW', label: '北墙宽（梯形）', type: 'range', min: 0, max: 300, step: 4, unit: '工具单位', only: ['city'], dep: { path: 'cityShape', equals: 'trapezoid' } },
        { path: 'wallH', label: '城墙高', type: 'range', min: 2.0, max: 7.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'wallBaseW', label: '墙底宽', type: 'range', min: 1.0, max: 4.0, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'wallTopW', label: '墙顶宽', type: 'range', min: 0.6, max: 3.0, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'merlon', label: '外侧垛口（雉堞）', type: 'toggle', only: ['city'] },
        { path: 'parapet', label: '内侧女墙', type: 'toggle', only: ['city'] },
        { path: 'gateCount', label: '正门门道数', type: 'select', opts: [{ v: 1, t: '1 门道' }, { v: 3, t: '3 门道' }, { v: 5, t: '5 门道' }], only: ['city'] },
        { path: 'gateW', label: '门道宽', type: 'range', min: 1.5, max: 3.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateH', label: '门洞高', type: 'range', min: 2.5, max: 4.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateTower', label: '城门楼', type: 'toggle', only: ['city'] },
        { path: 'gateSide', label: '开门面', type: 'select', opts: [{ v: 'front', t: '仅正门' }, { v: 'two', t: '南北两面' }, { v: 'four', t: '四面' }], only: ['city'] },
        { path: 'bastionN', label: '每面马面数（0 为不设）', type: 'range', min: 0, max: 12, step: 1, only: ['city'] },
        { path: 'bastionProj', label: '马面突出量', type: 'range', min: 0.8, max: 2.5, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'bastionN', notEquals: 0 } },
        { path: 'cornerTower', label: '四角角楼', type: 'toggle', only: ['city'] },
        { path: 'blocksX', label: '坊格·东西列数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'blocksZ', label: '坊格·南北行数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'streetW', label: '街宽', type: 'range', min: 1.0, max: 4.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'blockWallH', label: '坊墙高', type: 'range', min: 0.6, max: 1.8, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'axisHalls', label: '中轴殿数', type: 'range', min: 0, max: 3, step: 1, only: ['city'] },
        { path: 'axisPalace', label: '内廷后宫', type: 'toggle', only: ['city'] },
        { path: 'palaceCorner', label: '宫城方位', type: 'select', opts: [{ v: 'center', t: '居中' }, { v: 'north', t: '北部居中' }, { v: 'corner', t: '偏隅（西北）' }], only: ['city'] },
        { path: 'moatW', label: '护城河宽', type: 'range', min: 0, max: 10, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'moatD', label: '护城河深', type: 'range', min: 0.4, max: 2.0, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'moatW', notEquals: 0 } },
        { path: 'moatBridge', label: '城门石桥', type: 'toggle', only: ['city'], dep: { path: 'moatW', notEquals: 0 } }
      ]
    },
    {
      title: '八 · 渲染与出图',
      items: [
        { path: 'render.ppm', label: '像素 / 米', type: 'range', min: 8, max: 320, step: 4 },
        { path: 'render.pitch', label: '俯视角度', type: 'range', min: 18, max: 55, step: 1, unit: '°' },
        { path: 'render.outline', label: '描边', type: 'toggle' },
        { path: 'render.shadow', label: '投影', type: 'toggle' },
        { path: 'render.sunAz', label: '光照方位', type: 'select', opts: SHADOW_DIRS, dep: { path: 'render.shadow', equals: true } },
        { path: 'render.shadowAngle', label: '阴影长度', type: 'range', min: 0.6, max: 2.4, step: 0.05, dep: { path: 'render.shadow', equals: true } },
        { path: 'render.transparent', label: '透明底', type: 'toggle' }
      ]
    }
  ];

  const registry = [];

  function buildControls() {
    const host = $('#controls');
    host.innerHTML = '';
    GROUPS.forEach((g, gi) => {
      const box = document.createElement('div');
      box.className = 'group' + (gi === GROUPS.length - 1 ? ' collapsed' : '');
      const head = document.createElement('div');
      head.className = 'group-head';
      head.innerHTML = `<span class="dot"></span><h3>${g.title}</h3><span class="arrow">▾</span>`;
      head.addEventListener('click', () => box.classList.toggle('collapsed'));
      box.appendChild(head);
      const body = document.createElement('div');
      body.className = 'group-body';
      g.items.forEach((it) => body.appendChild(buildRow(it)));
      box.appendChild(body);
      host.appendChild(box);
    });
  }

  function buildRow(it) {
    const row = document.createElement('div');
    row.className = 'row' + (it.type === 'toggle' ? ' toggle-now' : '');
    if (it.only) row.dataset.only = it.only.join(',');
    if (it.dep) row.dataset.dep = JSON.stringify(it.dep);

    if (it.type === 'toggle') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><input type="checkbox" /></div>`;
      const cb = row.querySelector('input');
      cb.addEventListener('change', () => { setPath(state.recipe, it.path, cb.checked); onChange(it); });
      registry.push({ el: cb, it, kind: 'toggle' });
      return row;
    }

    if (it.type === 'select') {
      row.innerHTML = `<label>${it.label}</label><div class="ctl"><select></select></div>`;
      const sel = row.querySelector('select');
      it.opts.forEach((o) => {
        const op = document.createElement('option');
        op.value = o.v; op.textContent = o.t;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => { setPath(state.recipe, it.path, sel.value); onChange(it); });
      registry.push({ el: sel, it, kind: 'select' });
      return row;
    }

    if (it.type === 'multi') {
      row.style.display = 'block';
      const lab = document.createElement('div');
      lab.innerHTML = `<label style="flex:none">${it.label}</label>`;
      const box = document.createElement('div');
      box.className = 'toggle-row';
      it.opts.forEach((o) => {
        const l = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = o.v;
        cb.addEventListener('change', () => {
          let arr = getPath(state.recipe, it.path);
          if (!Array.isArray(arr)) { arr = []; setPath(state.recipe, it.path, arr); }
          if (cb.checked) { if (arr.indexOf(o.v) < 0) arr.push(o.v); }
          else { const i = arr.indexOf(o.v); if (i >= 0) arr.splice(i, 1); }
          onChange(it);
        });
        l.appendChild(cb); l.appendChild(document.createTextNode(o.t));
        box.appendChild(l);
        registry.push({ el: cb, it, kind: 'multi', value: o.v });
      });
      row.appendChild(lab);
      row.appendChild(box);
      return row;
    }

    if (it.type === 'series') {
      row.style.display = 'block';
      row.innerHTML = `<label style="flex:none">${it.label}</label><div class="series-box"></div>`;
      const box = row.querySelector('.series-box');
      const node = {
        el: box, it, kind: 'series',
        render() {
          const r = state.recipe;
          const n = Math.max(it.minCount || 1, Math.min(it.maxCount || 9, Number(getPath(r, it.countPath)) || 1));
          const base = it.baseValue != null ? it.baseValue : (Number(getPath(r, it.basePath || 'floorH')) || 3.2);
          let arr = getPath(r, it.path);
          if (!Array.isArray(arr) || arr.length !== n) {
            const fixed = Array.isArray(arr) ? arr : [];
            const out = [];
            for (let i = 0; i < n; i++) out.push(fixed[i] != null ? fixed[i] : base);
            arr = out; setPath(r, it.path, arr);
          }
          box.innerHTML = '';
          for (let i = 0; i < n; i++) {
            const wrap = document.createElement('span');
            wrap.className = 'series-cell';
            const tag = document.createElement('i');
            tag.textContent = (i + 1) + '';
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.min = it.min; inp.max = it.max; inp.step = it.step;
            inp.value = arr[i];
            inp.addEventListener('change', () => {
              let v = Number(inp.value);
              if (!isFinite(v)) v = base;
              v = Math.max(it.min, Math.min(it.max, v));
              inp.value = v;
              const cur = getPath(state.recipe, it.path);
              if (!Array.isArray(cur)) setPath(state.recipe, it.path, []);
              getPath(state.recipe, it.path)[i] = v;
              onChange(it);
            });
            wrap.appendChild(tag); wrap.appendChild(inp);
            box.appendChild(wrap);
          }
        }
      };
      node.render();
      registry.push(node);
      return row;
    }

    // range
    row.innerHTML = `<label>${it.label}</label>
      <div class="ctl"><input type="range" min="${it.min}" max="${it.max}" step="${it.step}">
      <span class="val"></span></div>`;
    const rg = row.querySelector('input');
    const val = row.querySelector('.val');
    const fmt = (v) => (it.step < 1 ? Number(v).toFixed(2) : Number(v)) + (it.unit || '');
    rg.addEventListener('input', () => {
      setPath(state.recipe, it.path, Number(rg.value));
      // 拖动“层高”＝整体统一层高，清掉逐层自定义值，避免滑块看起来没反应
      if (it.path === 'floorH') state.recipe.floorHList = [];
      val.textContent = fmt(rg.value);
      if (it.path === 'render.ppm' && state.syncDens) state.syncDens(Number(rg.value));
      onChange(it);
    });
    registry.push({ el: rg, it, kind: 'range', valEl: val, fmt });
    return row;
  }

  function syncControls() {
    const r = state.recipe;
    if (typeof r.pondOn !== 'boolean') r.pondOn = !!r.env.pond;
    registry.forEach((b) => {
      const v = getPath(r, b.it.path);
      if (b.kind === 'toggle') b.el.checked = !!v;
      else if (b.kind === 'select') b.el.value = v;
      else if (b.kind === 'range') { b.el.value = v; b.valEl.textContent = b.fmt(v); }
      else if (b.kind === 'multi') b.el.checked = (getPath(r, b.it.path) || []).indexOf(b.value) >= 0;
      else if (b.kind === 'series' && b.render) b.render();
    });
    if (state.syncDens) state.syncDens(r.render.ppm);
    applyVisibility();
  }

  /* 按「建筑类型」与「依赖开关」显隐 / 置灰控件：
     - only：该控件只对列出的类型有效
     - dep：依赖某个开关（或某个 select 的取值），不满足时置灰 */
  function depOK(it, r) {
    const d = it.dep;
    if (!d) return true;
    // 某些形制的该开关有专门语义（如亭的「栏杆样式」直接控制美人靠），不受通用依赖约束
    if (d.ignoreTypes && d.ignoreTypes.indexOf(r.type) >= 0) return true;
    const v = getPath(r, d.path);
    if (d.truthy && !v) return false;
    if (d.falsy && v) return false;
    if (d.oneOf && d.oneOf.indexOf(v) < 0) return false;
    if (d.notOneOf && d.notOneOf.indexOf(v) >= 0) return false;
    if (d.equals !== undefined && v !== d.equals) return false;
    if (d.notEquals !== undefined && v === d.notEquals) return false;
    return true;
  }

  function applyVisibility() {
    const r = state.recipe;
    const seen = new Set();
    registry.forEach((b) => {
      const row = b.el.closest('.row');
      if (!row || seen.has(row)) return;
      seen.add(row);
      let show = true;
      if (b.it.only) show = b.it.only.indexOf(r.type) >= 0;
      const ok = show && depOK(b.it, r);
      row.style.display = show ? '' : 'none';
      row.classList.toggle('dimmed', !ok);
      // 置灰的控件同时禁用，避免“点了没反应”的错觉
      row.querySelectorAll('input, select').forEach((inp) => { inp.disabled = !ok; });
    });
    // 空分组折叠提示
    document.querySelectorAll('.group').forEach((g) => {
      const rows = Array.prototype.slice.call(g.querySelectorAll('.row'));
      const anyVisible = rows.some((x) => x.style.display !== 'none');
      g.classList.toggle('empty', !anyVisible);
    });
  }

  let timer = null;
  function onChange() {
    // 水池开关联动
    if (state.recipe.pondOn && !state.recipe.env.pond) {
      state.recipe.env.pond = { x: 3.6, z: 5.4, w: 2.2, d: 1.5 };
    }
    if (!state.recipe.pondOn) state.recipe.env.pond = null;
    applyVisibility();
    clearTimeout(timer);
    timer = setTimeout(rebuild, 60);
  }

  /* ------------------------------ 渲染 ------------------------------ */
  function renderOpts(extra) {
    const r = state.recipe;
    return Object.assign({
      ppm: r.render.ppm,
      pitch: r.render.pitch,
      yaw: r.render.yaw,
      palette: r.render.palette,
      style: r.render.style,
      styleAmount: r.render.styleAmount,
      outline: r.render.outline,
      shadow: r.render.shadow,
      sunAz: r.render.sunAz,
      shadowAngle: r.render.shadowAngle,
      transparent: r.render.transparent,
      focus: !(r.env.showGround === true),
      seed: r.seed
    }, extra || {});
  }

  // 预览预算：画布在屏幕上就那么大，多出来的像素算出来也看不见（导出永远不传，全精度）
  function previewBudget(zoom) {
    const w = wrap.clientWidth || 1600;
    const h = wrap.clientHeight || 900;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const z = Math.min(2.5, Math.max(1, (zoom == null ? state.zoom : zoom) / 2));
    return w * h * dpr * dpr * z * z;
  }
  function previewOpts(extra) {
    return renderOpts(Object.assign({ preview: true, maxPixels: previewBudget(), gpu: state.gpu }, extra || {}));
  }

  function rebuild() {
    const r = state.recipe;
    if (state.playing) stopBuild(true);
    try {
      state.mesh = GF.build(r);
      state.moves = state.mesh.moves || [];
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      const b = state.mesh.bounds('ground');
      $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 占地 ${(b.x1 - b.x0).toFixed(1)}×${(b.z1 - b.z0).toFixed(1)}m`;
    } catch (e) {
      console.error(e);
      $('#stat').textContent = '渲染出错：' + e.message;
    }
  }

  /* --------------------------- 落成演示 --------------------------- */
  // 参考 threejs-architecture-effects 的做法：用一条 0–1 时间线驱动“基础→台基→柱梁→墙面→屋面→脊饰”
  // 自下而上逐层生长；演示时会降低渲染分辨率保证流畅，播完再回到设定精度。
  let buildRaf = 0;
  function stopBuild() {
    if (buildRaf) cancelAnimationFrame(buildRaf);
    buildRaf = 0;
    state.playing = false;
    const b = $('#btnBuild');
    if (b) b.classList.remove('on');
    if (b) b.textContent = '落成演示';
  }

  function playBuild() {
    if (!state.mesh) return;
    if (state.playing) { stopBuild(); rebuild(); return; }
    const b = state.mesh.bounds('ground');
    const y0 = Math.min(b.y0, -0.1), y1 = b.y1;
    const dur = 2800, t0 = performance.now();
    const opts = previewOpts({ ppm: Math.min(state.recipe.render.ppm, 13), pad: 5, clipY: y0, maxPixels: previewBudget() * 0.7 });
    state.playing = true;
    const btn = $('#btnBuild');
    if (btn) { btn.classList.add('on'); btn.textContent = '停止演示'; }
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; // ease-in-out
      opts.clipY = y0 - 0.4 + (y1 - y0 + 0.9) * e;
      state.frame = GF.render(state.mesh, opts);
      draw();
      if (p < 1) {
        buildRaf = requestAnimationFrame(step);
      } else {
        stopBuild();
        state.frame = GF.render(state.mesh, previewOpts());
        draw();
        const bb = state.mesh.bounds('ground');
        $('#stat').textContent = `出图 ${state.frame.w}×${state.frame.h}px · 三角面 ${state.mesh.triCount.toLocaleString()} · 占地 ${(bb.x1 - bb.x0).toFixed(1)}×${(bb.z1 - bb.z0).toFixed(1)}m`;
      }
    };
    buildRaf = requestAnimationFrame(step);
  }

  function draw() {
    const f = state.frame;
    if (!f) return;
    if (canvas.width !== f.w || canvas.height !== f.h) {
      canvas.width = f.w; canvas.height = f.h;
    }
    const img = new ImageData(new Uint8ClampedArray(f.rgba), f.w, f.h);
    ctx.putImageData(img, 0, 0);
    state.bbox = contentBBox(f);
    if (state.refit) { state.refit = false; viewAt(state.view || 'all'); } else layout();
  }

  // 图内实际内容（非透明像素）的包围盒，用于取景锚点
  function contentBBox(f) {
    const d = f.rgba;
    let x0 = f.w, x1 = 0, y0 = f.h, y1 = 0;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (d[(y * f.w + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0) return { x0: 0, y0: 0, x1: f.w, y1: f.h };
    return { x0, y0, x1, y1 };
  }

  // 多点位取景：倍率以“整帧刚好铺满舞台”为 1.0 基准，避免宽/高模型互相踩踏
  // 全景 1.0 恒不裁切；院落 1.4 / 屋面 1.7 / 门面 1.9 / 台基 2.1 为特写，超出部分可拖动查看
  const VIEWS = {
    all: { nx: 0.5, ny: 0.5, k: 1 },
    roof: { nx: 0.5, ny: 0.2, k: 1.7 },
    facade: { nx: 0.5, ny: 0.58, k: 1.9 },
    base: { nx: 0.5, ny: 0.84, k: 2.1 },
    court: { nx: 0.5, ny: 0.7, k: 1.4 }
  };

  function viewAt(name) {
    const f = state.frame;
    if (!f) return;
    const v = VIEWS[name] || VIEWS.all;
    state.view = VIEWS[name] ? name : 'all';
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
    const bb = state.bbox || { x0: 0, y0: 0, x1: f.w, y1: f.h };
    const fx = bb.x0 + (bb.x1 - bb.x0) * v.nx;
    const fy = bb.y0 + (bb.y1 - bb.y0) * v.ny;
    const availW = wrap.clientWidth * 0.86;
    const availH = wrap.clientHeight * 0.86;
    // 基准倍率永远按整帧算：任何模型在 1.0 都完整落在舞台内
    const fit = Math.min(availW / f.w, availH / f.h);
    const scale = fit * v.k;
    state.zoom = GF.clamp(2 * scale / fit, 0.5, 8);
    state.panX = -(fx - f.w / 2) * scale;
    state.panY = -(fy - f.h / 2) * scale;
    // 全景：画布小于舞台时把平移夹在留白内，保证整幅画面不被舞台边缘切到
    if (state.view === 'all') {
      const bx = Math.max(0, (wrap.clientWidth - f.w * scale) / 2);
      const by = Math.max(0, (wrap.clientHeight - f.h * scale) / 2);
      state.panX = GF.clamp(state.panX, -bx, bx);
      state.panY = GF.clamp(state.panY, -by, by);
    }
    layout();
  }

  function layout() {
    const f = state.frame;
    if (!f) return;
    // 适配：让画面占舞台 ~86%
    const availW = wrap.clientWidth * 0.86;
    const availH = wrap.clientHeight * 0.86;
    const fit = Math.min(availW / f.w, availH / f.h);
    const scale = fit * (state.zoom / 2);
    // 平移限制：可以移动到画面的任意部位，但不许把画面整块拖出视野
    const overX = Math.max(0, (f.w * scale - wrap.clientWidth) / 2 + wrap.clientWidth * 0.18);
    const overY = Math.max(0, (f.h * scale - wrap.clientHeight) / 2 + wrap.clientHeight * 0.18);
    state.panX = GF.clamp(state.panX, -overX, overX);
    state.panY = GF.clamp(state.panY, -overY, overY);
    canvas.style.width = (f.w * scale) + 'px';
    canvas.style.height = (f.h * scale) + 'px';
    // 绝对居中 + 平移：画面再大也围绕舞台中心缩放，不会只往右下角长
    canvas.style.transform = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px))`;
  }

  /* ------------------------------ 拖动陈设 ------------------------------ */
  // 渲染器返回正交投影映射（ox/oy/ppm + 相机基向量），据此做屏幕拾取与地面反算
  function framePt(clientX, clientY) {
    const f = state.frame, r = canvas.getBoundingClientRect();
    return { fx: (clientX - r.left) * f.w / r.width, fy: (clientY - r.top) * f.h / r.height, rect: r };
  }
  function projWorld(x, z) {
    const f = state.frame, m = f.map;
    const sx = x * m.right[0] + z * m.right[2];
    const sy = x * m.up[0] + z * m.up[2];
    return { fx: sx * m.ppm + m.ox, fy: -sy * m.ppm + m.oy };
  }
  function unproj(fx, fy) {
    const m = state.frame.map;
    const sx = (fx - m.ox) / m.ppm, sy = -(fy - m.oy) / m.ppm;
    const det = m.right[0] * m.up[2] - m.right[2] * m.up[0] || 1;
    return {
      x: (sx * m.up[2] - m.right[2] * sy) / det,
      z: (m.right[0] * sy - m.up[0] * sx) / det
    };
  }
  function pickMove(clientX, clientY) {
    const f = state.frame;
    if (!f || !state.moves) return null;
    const p = framePt(clientX, clientY);
    const k = p.rect.width / f.w;
    const tol = Math.max(18 * k, 24);
    let best = null, bestD = 1e9;
    for (const mv of state.moves) {
      const q = projWorld(mv.x, mv.z);
      const cy = q.fy - Math.min(2.2, mv.r) * f.map.ppm * 0.85; // 锚点抬到物体中部，好点中
      const d = Math.hypot(q.fx - p.fx, cy - p.fy);
      if (d < tol && d < bestD) { bestD = d; best = mv; }
    }
    return best;
  }
  let dragRaf = 0;
  function dragRender() {
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(() => {
      dragRaf = 0;
      try {
        state.mesh = GF.build(state.recipe);
        state.moves = state.mesh.moves || state.moves;
        const opts = previewOpts({ ppm: Math.min(state.recipe.render.ppm, 14), pad: 5 });
        state.frame = GF.render(state.mesh, opts);
        draw();
      } catch (e) { console.error(e); }
    });
  }

  /* ------------------------------ 交互 ------------------------------ */
  let dragging = null;
  let movingItem = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    if (state.moveMode && e.button === 0 && !e.shiftKey) {
      const hit = pickMove(e.clientX, e.clientY);
      if (!hit) return; // 拖动模式下视角锁定：点空处不旋转、不平移
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      movingItem = { key: hit.key, label: hit.label, dx: hit.x - w.x, dz: hit.z - w.z };
      setStat('拖动：' + hit.label + '（松手即落位）');
      return;
    }
    dragging = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey, yaw: state.recipe.render.yaw };
    canvas.classList.add('dragging');
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
  });
  window.addEventListener('mousemove', (e) => {
    if (movingItem) {
      const p = framePt(e.clientX, e.clientY);
      const w = unproj(p.fx, p.fy);
      state.recipe.env.move = state.recipe.env.move || {};
      state.recipe.env.move[movingItem.key] = { x: w.x + movingItem.dx, z: w.z + movingItem.dz };
      state.moves.forEach((m) => { if (m.key === movingItem.key) { m.x = w.x + movingItem.dx; m.z = w.z + movingItem.dz; } });
      dragRender();
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (dragging.pan) {
      state.panX += dx; state.panY += dy;
      dragging.x = e.clientX; dragging.y = e.clientY;
      layout();
    } else {
      state.recipe.render.yaw = (dragging.yaw + dx * 0.4 + 360) % 360;
      scheduleRender();
    }
  });
  window.addEventListener('mouseup', () => {
    if (movingItem) {
      movingItem = null;
      state.frame = GF.render(state.mesh, previewOpts());
      draw();
      return;
    }
    if (!dragging) return;
    // 松手吸附到最近的 15°
    state.recipe.render.yaw = Math.round(state.recipe.render.yaw / 15) * 15 % 360;
    dragging = null;
    canvas.classList.remove('dragging');
    scheduleRender(true);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    state.zoom = GF.clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
    // 以光标为锚点缩放
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const k = state.zoom / old;
    state.panX -= dx * (k - 1);
    state.panY -= dy * (k - 1);
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
    layout();
  }, { passive: false });
  // 双击画面 = 居中复位
  canvas.addEventListener('dblclick', () => {
    if (state.moveMode) { setStat('拖动模式下视角已锁定'); return; }
    state.panX = state.panY = 0; viewAt('all');
  });

  let raf = 0;
  function scheduleRender(force) {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; rebuild(); });
  }

  /* ------------------------------ 导出 ------------------------------ */
  function download(bytes, filename, mime) {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  function renderDirs(n) {
    const r = state.recipe;
    const frames = [];
    for (let i = 0; i < n; i++) {
      frames.push(GF.render(state.mesh, {
        ppm: r.render.ppm, pitch: r.render.pitch,
        yaw: (i * 360) / n, palette: r.render.palette,
        style: r.render.style, styleAmount: r.render.styleAmount,
        outline: r.render.outline, shadow: r.render.shadow,
        transparent: r.render.transparent, seed: r.seed
      }));
    }
    return frames;
  }

  function recipeName() {
    return (state.recipe.preset || 'guofeng') + '_' + state.recipe.type;
  }

  function exportPNG() {
    if (state.busy) return;
    // 预览帧按屏幕像素降过档，单张导出必须按配方 ppm 全精度重算
    setBusy(true, '按全精度出图…');
    setTimeout(() => {
      try {
        const f = GF.render(state.mesh, renderOpts());
        const png = GF.encodePNG(f.w, f.h, f.rgba);
        download(png, `国风古建_${recipeName()}.png`, 'image/png');
        setStat(`全精度出图 ${f.w}×${f.h}px`);
      } catch (e) { console.error(e); setStat('导出出错：' + e.message); }
      setBusy(false, '');
    }, 0);
  }

  // 多帧导出会连续渲染 8 / 4 次，必须分帧让出主线程，并给出「渲染中」反馈
  function nextFrame() {
    return new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
  }
  function setStat(text) { const s = $('#stat'); if (s) s.textContent = text; }
  // 拖动陈设时锁视角：旋转 / 取舍景 / 双击复位都不生效，避免一拖就转跑偏
  function lockView() {
    if (!state.moveMode) return false;
    setStat('拖动模式下视角已锁定，先关掉「拖动陈设」再调视角');
    return true;
  }
  function setBusy(on, text) {
    state.busy = on;
    document.querySelectorAll('#btnExport,#btnSheet,#btnZip,#btnSave,#btnRandom').forEach((b) => { b.disabled = on; });
    if (text) setStat(text);
  }

  async function exportSheet() {
    if (state.busy) return;
    try {
      const frames = [];
      for (let i = 0; i < 8; i++) {
        setBusy(true, `渲染中… 八向精灵表 ${i + 1}/8`);
        await nextFrame();
        frames.push(renderOne(i * 45));
      }
      setBusy(true, '编码 PNG…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 10, cols: 4 });
      download(GF.encodePNG(sheet.w, sheet.h, sheet.rgba), `国风古建_${recipeName()}_八向.png`, 'image/png');
      setBusy(false, '八向精灵表已导出');
    } catch (e) { console.error(e); setBusy(false, '导出失败：' + e.message); }
  }

  function renderOne(yaw) {
    const r = state.recipe;
    return GF.render(state.mesh, {
      ppm: r.render.ppm, pitch: r.render.pitch, yaw,
      palette: r.render.palette, style: r.render.style,
      styleAmount: r.render.styleAmount, outline: r.render.outline,
      shadow: r.render.shadow, transparent: r.render.transparent, seed: r.seed
    });
  }

  async function exportZip() {
    if (state.busy) return;
    try {
      const r = state.recipe;
      const files = [];
      const frames = [];
      for (let i = 0; i < 4; i++) {
        setBusy(true, `渲染中… 四向分包 ${i + 1}/4`);
        await nextFrame();
        const f = renderOne(i * 90);
        frames.push(f);
        files.push({ name: `dir_${i}.png`, data: GF.encodePNG(f.w, f.h, f.rgba) });
      }
      setBusy(true, '合成精灵表…');
      await nextFrame();
      const sheet = GF.composeSheet(frames, { pad: 8, cols: 4 });
      files.push({ name: 'sheet.png', data: GF.encodePNG(sheet.w, sheet.h, sheet.rgba) });
      files.push({ name: 'recipe.json', data: new TextEncoder().encode(JSON.stringify(r, null, 2)) });
      download(GF.makeZip(files), `国风古建_${recipeName()}.zip`, 'application/zip');
      setBusy(false, 'ZIP 已导出');
    } catch (e) { console.error(e); setBusy(false, '导出失败：' + e.message); }
  }

  function saveRecipe() {
    const json = JSON.stringify(state.recipe, null, 2);
    download(new TextEncoder().encode(json), `国风配方_${recipeName()}.json`, 'application/json');
  }

  /* ------------------------------ 事件绑定 ------------------------------ */
  function bindUI() {
    const chips = $('#presetChips');
    GF.presetList.forEach((p) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = p.name;
      c.dataset.key = p.key;
      c.addEventListener('click', () => {
        state.recipe = GF.getPreset(p.key);
        state.panX = state.panY = 0;
        state.view = 'all';
        state.refit = true;
        markChip(p.key);
        syncControls();
        rebuild();
      });
      chips.appendChild(c);
    });
    markChip('siheyuan');

    $('#btnRandom').addEventListener('click', () => {
      state.recipe = GF.randomRecipe(Date.now() % 1e9);
      state.view = 'all';
      state.refit = true;
      markChip(null);
      syncControls();
      rebuild();
    });
    $('#btnExport').addEventListener('click', exportPNG);
    $('#btnSheet').addEventListener('click', exportSheet);
    $('#btnZip').addEventListener('click', exportZip);
    $('#btnSave').addEventListener('click', saveRecipe);
    $('#btnLoad').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          state.recipe = GF.normalize(JSON.parse(fr.result));
          state.view = 'all';
          state.refit = true;
          markChip(null);
          syncControls();
          rebuild();
        } catch (err) { alert('配方解析失败：' + err.message); }
      };
      fr.readAsText(f);
      e.target.value = '';
    });

    $('#rotL').addEventListener('click', () => {
      if (lockView()) return;
      state.recipe.render.yaw = (state.recipe.render.yaw + 45) % 360;
      updateCamInfo(); scheduleRender();
    });
    $('#rotR').addEventListener('click', () => {
      if (lockView()) return;
      state.recipe.render.yaw = (state.recipe.render.yaw - 45 + 360) % 360;
      updateCamInfo(); scheduleRender();
    });
    $('#btnAxis').addEventListener('click', () => {
      if (lockView()) return;
      // 中轴：只把旋向转到 0°（正立面），俯角与当前缩放/平移原样保留
      state.recipe.render.yaw = 0;
      state.view = null;
      document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('on'));
      updateCamInfo();
      syncControls();
      scheduleRender();
    });
    $('#btnMove').addEventListener('click', () => {
      state.moveMode = !state.moveMode;
      const b = $('#btnMove');
      b.classList.toggle('on', state.moveMode);
      canvas.style.cursor = state.moveMode ? 'grab' : '';
      setStat(state.moveMode ? '拖动模式：点击树 / 假山 / 石灯 / 幡旗 / 水池即可拖动' : '已退出拖动模式');
    });
    $('#btnBuild').addEventListener('click', playBuild);
    // 顶栏「像素密度」拉条：与面板里的 render.ppm 双向同步，拖动即重绘
    const densRange = $('#densRange'), densVal = $('#densVal');
    if (densRange) {
      const paintDens = (v) => { densRange.value = v; densVal.textContent = v; };
      paintDens(state.recipe.render.ppm);
      state.syncDens = paintDens;
      densRange.addEventListener('input', () => {
        const v = Number(densRange.value);
        state.recipe.render.ppm = v;
        densVal.textContent = v;
        registry.forEach((b) => {
          if (b.kind === 'range' && b.it && b.it.path === 'render.ppm') { b.el.value = v; b.valEl.textContent = b.fmt(v); }
        });
        onChange();
      });
    }
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => { if (!lockView()) viewAt(btn.dataset.view); });
    });
    $('#btnFull').addEventListener('click', () => {
      const root = document.documentElement;
      if (!document.fullscreenElement) {
        const p = root.requestFullscreen ? root.requestFullscreen() : null;
        if (p && p.catch) p.catch(() => setStat('此浏览器不允许全屏，可改用浏览器全屏键 F11'));
      } else {
        document.exitFullscreen();
      }
      setTimeout(layout, 120);
    });
    $('#btnCut').addEventListener('click', () => {
      const c = state.recipe.cut;
      const on = !(c.front && c.right && c.roof);
      c.front = on; c.right = on; c.roof = on;
      syncControls(); rebuild();
    });

    $('#btnMode').addEventListener('click', () => {
      state.gpu = !state.gpu;
      try { localStorage.setItem('gf.renderMode', state.gpu ? 'gpu' : 'cpu'); } catch (e) {}
      paintMode();
      rebuild();
    });

    $('#btnHelp').addEventListener('click', () => $('#helpModal').classList.add('open'));
    $('#btnHelpClose').addEventListener('click', () => $('#helpModal').classList.remove('open'));
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') e.currentTarget.classList.remove('open');
    });

    window.addEventListener('resize', layout);
    // 调试入口：便于命令行 / 浏览器脚本核对取景、拖动与配方状态
    window.__gf = { state: () => state, proj: (x, z) => projWorld(x, z), pick: (x, y) => pickMove(x, y) };
    document.addEventListener('fullscreenchange', () => setTimeout(layout, 60));
  }

  function markChip(key) {
    document.querySelectorAll('.chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.key === key);
    });
  }

  function updateCamInfo() {
    $('#camInfo').textContent = `俯视 ${state.recipe.render.pitch}° · 旋向 ${Math.round(state.recipe.render.yaw)}° · 每次 45°`;
  }

  /* ------------------------------ 启动 ------------------------------ */
  buildControls();
  bindUI();
  paintMode();
  syncControls();
  updateCamInfo();
  rebuild();
  window.addEventListener('resize', () => setTimeout(layout, 60));
})();


