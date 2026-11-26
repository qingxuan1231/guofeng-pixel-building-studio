'use strict';
  /* ------------------------------ 控件定义 ------------------------------ */
  const TYPES = [
    { v: 'hall', t: '殿 / 堂' },
    { v: 'house', t: '民居' },
    { v: 'courtyard', t: '院落（宅院 / 园林 / 寺院）' },
    { v: 'pavilion', t: '亭' },
    { v: 'round', t: '圆殿 / 圆楼（圆形平面）' },
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
  // 朝代做法见 README「形制依据」：普拍枋自唐初已见，但唐辽大木多省用；宋辽扁宽成 T 字；
  // 金元渐厚；明清反狭于阑额。斗栱尺度与补间密度同步变。
  const ERAS = [
    { v: 'han', t: '汉（无普拍枋，斗栱简拙）' },
    { v: 'tang', t: '唐辽（无普拍枋，铺作硕大）' },
    { v: 'song', t: '宋（普拍枋扁宽成 T 字）' },
    { v: 'jin', t: '金（普拍枋加厚）' },
    { v: 'yuan', t: '元（普拍枋近阑额）' },
    { v: 'ming', t: '明（普拍枋狭于阑额）' },
    { v: 'qing', t: '清（平板枋狭而厚，铺作小而密）' }
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
        { path: 'era', label: '朝代做法', type: 'select', opts: ERAS },
        { path: 'bays', label: '面阔间数', type: 'range', min: 1, max: 7, step: 1, only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'bayW', label: '每间面阔', type: 'range', min: 2.0, max: 4.4, step: 0.1, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'depth', label: '进深', type: 'range', min: 3.6, max: 11, step: 0.2, unit: 'm', only: ['hall', 'house', 'ge', 'xie'] },
        { path: 'floors', label: '层数', type: 'range', min: 1, max: 3, step: 1, only: ['hall', 'house', 'ge'] },
        { path: 'radius', label: '亭 / 塔半径', type: 'range', min: 1.4, max: 4.0, step: 0.1, unit: 'm', only: ['pavilion', 'pagoda'] },
        { path: 'sides', label: '亭身面数', type: 'range', min: 4, max: 12, step: 2, only: ['pavilion'] },
        { path: 'tiers', label: '塔层数', type: 'range', min: 3, max: 9, step: 1, only: ['pagoda'] },
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
      title: '二 · 剖切（室内外无缝）',
      items: [
        { path: 'cut.front', label: '隐藏前墙', type: 'toggle', only: WALLED },
        { path: 'cut.back', label: '隐藏后墙', type: 'toggle', only: WALLED },
        { path: 'cut.left', label: '隐藏左墙', type: 'toggle', only: WALLED },
        { path: 'cut.right', label: '隐藏右墙', type: 'toggle', only: WALLED },
        { path: 'cut.roof', label: '隐藏屋面', type: 'toggle', only: ROOFED }
      ]
    },
    {
      title: '三 · 环境与陈设',
      items: [
        { path: 'env.showGround', label: '显示场地', type: 'toggle' },
        { path: 'env.groundType', label: '场地类型', type: 'select', opts: SCENES, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.ground', label: '岸面材质', type: 'select', opts: GROUNDS, dep: { path: 'env.showGround', equals: true } },
        { path: 'env.groundSize', label: '场地半径', type: 'range', min: 4, max: 16, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterW', label: '水面宽度', type: 'range', min: 3, max: 12, step: 0.5, unit: 'm', dep: { path: 'env.showGround', equals: true } },
        { path: 'env.waterSide', label: '水面在', type: 'select', opts: [{ v: 'front', t: '前方' }, { v: 'back', t: '后方' }, { v: 'left', t: '左侧' }, { v: 'right', t: '右侧' }], dep: { path: 'env.showGround', equals: true } },
        { path: 'pondOn', label: '水池', type: 'toggle' },
      ]
    },
    {
      title: '四 · 绘画风格',
      items: [
        { path: 'render.style', label: '画风', type: 'select', opts: STYLES },
        { path: 'render.styleAmount', label: '风格强度', type: 'range', min: 0, max: 1, step: 0.05, dep: { path: 'render.style', notEquals: 'pixel' } },
        { path: 'render.palette', label: '配色底子', type: 'select', opts: PALETTES }
      ]
    },
    {
      title: '五 · 城制',
      items: [
        { path: 'cityShape', label: '平面形制', type: 'select', opts: [{ v: 'rect', t: '矩形' }, { v: 'trapezoid', t: '梯形（南宽北窄）' }], only: ['city'] },
        { path: 'cityW', label: '城垣面宽', type: 'range', min: 80, max: 420, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'cityD', label: '城垣进深', type: 'range', min: 80, max: 400, step: 5, unit: '工具单位', only: ['city'] },
        { path: 'northW', label: '北墙宽（梯形）', type: 'range', min: 0, max: 300, step: 4, unit: '工具单位', only: ['city'], dep: { path: 'cityShape', equals: 'trapezoid' } },
        { path: 'wallH', label: '城墙高', type: 'range', min: 2.0, max: 7.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'wallProfile', label: '城墙收分档', type: 'select', opts: GF.WALL_PROFILE_OPTS, only: ['city'] },
        { path: 'wallBaseW', label: '墙底宽', type: 'range', min: 1.0, max: 4.0, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'wallProfile', equals: 'custom' } },
        { path: 'wallTopW', label: '墙顶宽（档位反算）', type: 'range', min: 0.3, max: 4.0, step: 0.1, unit: 'm', digits: 4, only: ['city'], dep: { path: 'wallProfile', equals: 'custom' } },
        { path: 'merlon', label: '外侧垛口（雉堞）', type: 'toggle', only: ['city'] },
        { path: 'merlonStep', label: '垛口间距', type: 'range', min: 0.8, max: 4.0, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'merlon', equals: true } },
        { path: 'merlonW', label: '垛口宽', type: 'range', min: 0.3, max: 1.2, step: 0.05, unit: 'm', only: ['city'], dep: { path: 'merlon', equals: true } },
        { path: 'merlonH', label: '垛口高', type: 'range', min: 0.3, max: 1.4, step: 0.05, unit: 'm', only: ['city'], dep: { path: 'merlon', equals: true } },
        { path: 'parapet', label: '内侧女墙', type: 'toggle', only: ['city'] },
        { path: 'parapetH', label: '内侧女墙高', type: 'range', min: 0.2, max: 1.0, step: 0.05, unit: 'm', only: ['city'], dep: { path: 'parapet', equals: true } },
        { path: 'gateCount', label: '正门门道数', type: 'select', opts: [{ v: 1, t: '1 门道' }, { v: 3, t: '3 门道' }, { v: 5, t: '5 门道' }], only: ['city'] },
        { path: 'gateW', label: '门道宽', type: 'range', min: 1.5, max: 3.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateH', label: '门洞高', type: 'range', min: 2.5, max: 4.5, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'gateArch', label: '门洞样式', type: 'select', opts: [{ v: 'arch', t: '券门（半圆拱）' }, { v: 'guijiao', t: '圭角门（平顶抹角）' }], only: ['city'] },
        { path: 'gateTower', label: '城门楼', type: 'toggle', only: ['city'] },
        { path: 'gateSide', label: '开门面', type: 'select', opts: [{ v: 'front', t: '仅正门' }, { v: 'two', t: '南北两面' }, { v: 'four', t: '四面' }], only: ['city'] },
        { path: 'bastionN', label: '每面马面数（0 为不设）', type: 'range', min: 0, max: 12, step: 1, only: ['city'] },
        { path: 'bastionProj', label: '马面突出量', type: 'range', min: 0.8, max: 2.5, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'bastionN', notEquals: 0 } },
        { path: 'bastionW', label: '马面宽（0 随墙顶）', type: 'range', min: 0, max: 6, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'bastionN', notEquals: 0 } },
        { path: 'bastionTower', label: '马面敌楼', type: 'toggle', only: ['city'], dep: { path: 'bastionN', notEquals: 0 } },
        { path: 'cornerTower', label: '四角角楼', type: 'toggle', only: ['city'] },
        { path: 'wengcheng', label: '瓮城（屈曲开门）', type: 'toggle', only: ['city'] },
        { path: 'wengD', label: '瓮城进深', type: 'range', min: 5, max: 24, step: 0.5, unit: 'm', only: ['city'], dep: { path: 'wengcheng', equals: true } },
        { path: 'wengW', label: '瓮城面宽', type: 'range', min: 10, max: 40, step: 0.5, unit: 'm', only: ['city'], dep: { path: 'wengcheng', equals: true } },
        { path: 'wengOffset', label: '瓮城门偏移', type: 'range', min: 0, max: 0.5, step: 0.05, only: ['city'], dep: { path: 'wengcheng', equals: true } },
        { path: 'arrowTower', label: '瓮城箭楼', type: 'toggle', only: ['city'], dep: { path: 'wengcheng', equals: true } },
        { path: 'blocksX', label: '坊格·东西列数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'blocksZ', label: '坊格·南北行数', type: 'range', min: 1, max: 14, step: 1, only: ['city'] },
        { path: 'streetW', label: '街宽', type: 'range', min: 1.0, max: 4.0, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'streetMode', label: '街市模式', type: 'select', opts: [{ v: 'ward', t: '坊制（坊墙+坊门）' }, { v: 'market', t: '街市（临街店铺+丁字路口）' }], only: ['city'] },
        { path: 'life', label: '生活层（摊/幌/灯）', type: 'toggle', only: ['city'] },
        { path: 'lifeDensity', label: '生活层密度', type: 'range', min: 0.1, max: 1, step: 0.05, only: ['city'], dep: { path: 'life', equals: true } },
        { path: 'night', label: '夜市模式（灯更多）', type: 'toggle', only: ['city'], dep: { path: 'life', equals: true } },
        { path: 'blockWallH', label: '坊墙高', type: 'range', min: 0.6, max: 1.8, step: 0.1, unit: 'm', only: ['city'] },
        { path: 'axisHalls', label: '中轴殿数', type: 'range', min: 0, max: 3, step: 1, only: ['city'] },
        { path: 'axisPalace', label: '内廷后宫', type: 'toggle', only: ['city'] },
        { path: 'palaceCorner', label: '宫城方位', type: 'select', opts: [{ v: 'center', t: '居中' }, { v: 'north', t: '北部居中' }, { v: 'corner', t: '偏隅（西北）' }], only: ['city'] },
        { path: 'moatW', label: '护城河宽', type: 'range', min: 0, max: 10, step: 0.2, unit: 'm', only: ['city'] },
        { path: 'moatD', label: '护城河深', type: 'range', min: 0.4, max: 2.0, step: 0.1, unit: 'm', only: ['city'], dep: { path: 'moatW', notEquals: 0 } },
        { path: 'moatBridge', label: '城门石桥', type: 'toggle', only: ['city'], dep: { path: 'moatW', notEquals: 0 } },
        { path: 'drawbridge', label: '吊桥（木桥）', type: 'toggle', only: ['city'], dep: { path: 'moatW', notEquals: 0 } },
        { path: 'bridgeUp', label: '吊桥收起', type: 'toggle', only: ['city'], dep: { path: 'drawbridge', equals: true } }
      ]
    },
    {
      title: '六 · 渲染与出图',
      items: [
        { path: 'render.ppm', label: '像素 / 米', type: 'range', min: 8, max: 120, step: 4 },
        { path: 'render.pitch', label: '俯视角度', type: 'range', min: 18, max: 55, step: 1, unit: '°' },
        { path: 'render.persp', label: '透视强度', type: 'range', min: 0, max: 1, step: 0.05 },
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
    const fmt = (v) => {
      const dec = it.digits != null ? it.digits : (it.step < 1 ? 2 : 0);
      return Number(v).toFixed(dec) + (it.unit || '');
    };
    rg.addEventListener('input', () => {
      if (it.path === 'render.pitch') {
        val.textContent = fmt(rg.value);
        setPitch(Number(rg.value));
        return;
      }
      if (it.path === 'render.persp') {
        val.textContent = String(Math.round(Number(rg.value) * 100) / 100);
        setPersp(Number(rg.value));
        return;
      }
      setPath(state.recipe, it.path, Number(rg.value));
      // 拖动“层高”＝整体统一层高，清掉逐层自定义值，避免滑块看起来没反应
      if (it.path === 'floorH') state.recipe.floorHList = [];
      val.textContent = fmt(rg.value);
      if (it.path === 'render.ppm' && state.syncDens) state.syncDens(Number(rg.value));
      onChange(it);
    });
    if (it.path === 'render.pitch') bindPitchSlider(rg);
    if (it.path === 'render.persp') bindPerspSlider(rg);
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
    syncPitchUI();
    syncPerspUI();
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
  function onChange(it) {
    // 收分档切换：立刻把顶宽按档位反算写回配方，避免面板显示旧值
    if (it && (it.path === 'wallProfile' || it.path === 'wallH')) {
      const sec = GF.wallProfileSection(state.recipe.wallProfile, state.recipe.wallH, state.recipe.wallBaseW);
      if (sec) {
        state.recipe.wallBaseW = sec.base;
        state.recipe.wallTopW = sec.top;
        syncControls();
      }
    }
    // 水池开关联动
    if (state.recipe.pondOn && !state.recipe.env.pond) {
      state.recipe.env.pond = { x: 3.6, z: 5.4, w: 2.2, d: 1.5 };
    }
    if (!state.recipe.pondOn) state.recipe.env.pond = null;
    applyVisibility();
    clearTimeout(timer);
    timer = setTimeout(rebuild, 60);
  }