/* 公共说明弹层：古建工坊与城池工坊共用同一份内容与组件
 * ---------------------------------------------------------------
 * 页面结构（两页相同）：
 *   <div class="modal" id="helpModal" data-mode="build|city">
 *     <div class="modal-card" id="helpBody"></div>
 *   </div>
 * 本文件在 app.js / city-app.js 之前引入，会立即把内容塞进 #helpBody。
 * 古建页 = 原有说明全文（一字不改）；城池页 = 全文 + 末尾追加“城池工坊专属”。
 * 维护原则：正文只留这一份，不要再往 HTML 里贴第二份。
 */
(function (global) {
  'use strict';
  const GF = (global.GF = global.GF || {});

  /* 正文：古建原有说明，原样保留（19 条 + 4 段参考/提示） */
  const CORE = `
      <p>这是一款本地离线的国风古建生成器：以“三维参数化 → 正交投影 → 像素化后处理”的流程，把构件级的三维古建渲染成可进游戏的 2:1 像素等轴素材。</p>
      <ul>
        <li><b>左侧参数</b>：形制、开间、屋顶、墙体、门窗、剖切、环境、渲染，改哪一项都会即时重排整栋建筑。</li>
        <li><b>屋顶</b>：悬山/硬山、歇山、庑殿、攒尖、卷棚（元宝脊）、十字歇山、盝顶；另有重檐、腰檐、剪边、悬鱼惹草、檐角风铎。</li>
        <li><b>台基与栏杆</b>：须弥座 / 直台基 / 毛石台；石栏望柱、木寻杖、美人靠。</li>
        <li><b>细部</b>：一斗三升 / 五踩 / 七踩斗拱、栱眼壁、雀替、匾额、楹联、门簪、抱鼓石、井口天花、藻井；檐口瓦当 + 滴水 + 连檐，窗楣 + 窗台，墙脚阶条石 / 楼层腰线，踏跺御路石，塔身贴面开窗。</li>
        <li><b>植物与假山</b>：松按分枝结构做——主干四段渐细、略欹侧，轮生六轮枝（下四上三），每枝分三级、枝身侧芽也出叶，枝端与侧芽都团成三维针球（每球九至十二根针，方位与仰角各不相同，两根一组微夹夹角）；竹丛生六到七竿，一竿七节逐节收细、节处凸环，下部一节不出枝，其上每节左右互生一到二枝，每枝分三小枝、小枝端五到七片窄长叶，竿顶另有一簇；柳主干短粗，六到八根粗枝斜上、枝端各垂七到九条柳条，条上互生小叶；梅老干作弯势，四五主枝再分三级小枝，五瓣花与花蕾沿枝散布；枫、银杏、杂树共用一套阔叶骨架：一根从根到梢的通高主干（五段渐收、略欹侧），主枝沿干分三层斜上出、每枝中段分两副枝，叶簇挂在副枝、主枝沿程与冠壳四环上，冠心再立三簇填中空，所以主干到顶都是同一根、冠是连片不是碎杈；芭蕉八片长扇叶外垂。太湖石讲瘦皱漏透：一对粗腿到腰，石冠三层跨过两腿、逐层收成馒头状，中间是一孔真高拱，前后左右都望得穿；面上按三重正弦做溶蚀皱，冠顶压错位横石再起短峰。千层石按沉积岩层理：层厚分明、厚薄不均，层面带波痕、整块顺一方向缓倾，出挑极小，层间夹薄泥层换色，整块宽而矮、顶上平压一层。</li>
        <li><b>朝代做法</b>：一 · 形制与尺度里的「朝代做法」分汉 / 唐 / 宋 / 金 / 元 / 明 / 清七档，换档改的是阑额断面、普拍枋、铺作疏密与材色。唐辽不施普拍枋，斗栱直接坐在阑额上，补间稀疏、铺作大、通体丹粉；宋辽普拍枋扁宽，与阑额在断面上成 T 字；金元渐厚，与阑额所出无几；明清普拍枋反狭于阑额，铺作小而密，额枋走青绿彩画。殿身、厅堂、楼阁各层腰檐与城楼同随朝代变，塔身与院落格局不动。</li>
        <li><b>院落</b>：四合院、江南园林（月洞门 + 影壁对景 + 叠山理水 + 曲桥湖心亭）、寺院（山门 + 钟鼓楼 + 五间大殿）；「院落进数」1~5 进，每进一座正房，进与进之间砌内隔墙、中留内门（带门罩），厢房与游廊挂在首进，院深随进数自动加长。</li>
        <li><b>组件拖拽条</b>：画布底边、键位提示正上方一排组件卡，分树 / 石 / 陈设三组二十种；按住可拖进画面，点一下则落在画面中心。点中物件后画布上给白底金框名称牌、金色虚线圆、四角对焦框与地面十字落点，下方编辑面板常开并列出已放各件，三根滑条分别调高度、旋转、大小（未选中时置灰），另有删除与取消选中，数量不限。配方自带的树 / 假山 / 幡 / 道具会在首次构建时展开成单件（虚线卡、无「· 新」标记），和手动拖入的件一样能选中、移位、调整与删除，分别记在 env.auto 与 env.items 里。</li>
        <li><b>建筑本体栏</b>：同一条栏上还有第二套选择栏与编辑器，栏首的「⇄ 切换到建筑本体 / ⇄ 切换到陈设组件」在陈设与建筑之间来回——同一时刻只出现一套栏，两套编辑器同步换手，选中的件 / 段也一并清空；建筑模式下画布不再拾取树石陈设。建筑按段拆开：台基、每层（楼阁按层数、塔按塔层逐层列出，单层写作屋身）、屋面·脊饰，点一段即在画布上给金色虚线包围盒与名称牌。原来左侧「形制与尺度 / 屋面 / 墙体与门窗」里的逐件参数已全部并进这套编辑器：台基调台基高 / 踏跺 / 形制 / 栏杆；每层调层高 / 出檐 / 收分 / 斗拱铺作 / 墙面 / 门窗 / 平座 / 副阶 / 匾额雀替 / 抱厦等；屋面调屋顶形制 / 瓦色（含绿琉璃、孔雀蓝）/ 举折 / 起翘 / 正脊 / 脊兽 / 宝顶 / 剪边 / 悬鱼 / 风铎。改瓦色会同时换瓦材，绿琉璃才真的变绿。面板在画面右侧，抓标题条可拖动，滑条可连续拖不卡一格。</li>
        <li><b>剖切</b>：勾选“前墙/右墙”或“隐藏屋面”，即可看到室内隔断（碧纱橱）、家具与陈设，做到室内外无缝。</li>
        <li><b>绘画风格</b>：右侧「六 · 绘画风格」单独成组（画风 / 风格强度 / 配色底子）。画风共 8 种——像素硬边（原味）、水墨手绘、枯笔速写、双色套印、工笔重彩、木刻版画、金石拓片、水彩晕染；风格强度控制各画风的力度，配色底子另有水墨·宣纸 / 赭石·双套印 / 青绿·绢本。</li>
        <li><b>预置</b>：顶上「配方」一排按钮共 43 个，含「八角亭」「木塔·五层」（每层带平座）「五间歇山正殿」「滕王阁」。唐长安 / 洛阳 / 明清北京 / 紫禁城这四座城已迁到「城池工坊」，本页只出单体建筑。</li>
        <li><b>逐层微调</b>：一 · 形制与尺度里有「逐层层高（殿 / 阁）」与「逐层层高（塔）」，每层一个数字框，层数改了格子自动增减；塔另有「逐层收分比」、「层间平座（木围栏）」开关与「平座栏杆」样式（木栏杆 / 石栏）。拖动「层高」滑块会清掉逐层值回到统一层高。</li>
        <li><b>副阶周匝</b>：塔勾上「副阶周匝（底层围廊）」后，底层外圈出柱加一圈腰檐；殿 / 厅堂勾上后四周出一圈廊柱 + 一层下檐，直接变重檐。出挑可调 0.8–3.0m，台基自动放大；「木塔·五层」默认开着。</li>
        <li><b>塔的逐层细部</b>：另有「逐层出檐」（每层 0.3–2.0m）与「逐层斗拱铺作」（每层 0–3 档：无 / 一斗三升 / 五踩 / 七踩），改动都按层生效。</li>
        <li><b>像素密度</b>：顶栏那条「像素密度」拉条就是出图密度（8–320 像素/米，初次加载只按 16 算）。构件细节——瓦垄、椽子、斗拱铺作、窗棂格心、檐角起翘——一律按最高密度那一档生成，拉高密度不会换一套模型，只是把它看得更清楚。拖一下即时重绘；面板「七 · 渲染与出图」里的同名滑杆与它联动。320 时单体建筑约 5000–6000px；城太大不在此列，城池页仍是 6–44。</li>
        <li><b>看不见的部分</b>：预览每一次重绘都从<b>当前视角</b>重算一遍可见性——屏幕外的像素不算、被前面墙面 / 屋面挡死的小构件整块跳过。转动视角、缩放、换配方、改参数都会立刻重算，不是建的时候扫一次；导出始终走全精度。</li>
        <li><b>GPU / CPU</b>：顶栏那颗「GPU / CPU」是渲染内核开关。GPU 走 WebGL2 硬件光栅（投影、z-buffer、色阶、砖缝木纹、地面阴影都在显卡上跑，描边仍在 CPU 上勾），预览比 CPU 快 2.5–4 倍（标准城 137ms vs 506ms，民居 51ms vs 149ms）；老显卡、没 WebGL2、或出图尺寸超过显卡纹理上限时自动按 CPU 跑，状态栏会写明「GPU」还是「CPU」以及耗时。两边的面级颗粒系数是同一套面中心哈希，逐像素平均色差只有 3–6/255，肉眼分不出。<b>导出 PNG / 精灵表 / ZIP 现在也走这颗开关</b>：选 GPU 就用硬件光栅全精度直出（320 px/m 这类大图会快好几倍），选 CPU 则与以前一样逐字节可复现。</li>
        <li><b>导出</b>：单张 PNG、八方向精灵表、ZIP（含 <code>recipe.json</code> 配方）三种方式。PNG 均为透明底，可直接拖进 Unity/Godot。</li>
        <li><b>取景</b>：出图默认以建筑本体居中（场地、树木只作背景）。顶栏「全景 / 屋面 / 门面 / 台基 / 院落」可一键跳到对应部位的放大视角；「中轴」把旋向转到 0° 正立面、保持当前缩放与俯角。滚轮以光标为锚点缩放，右键或 Shift 拖动平移，双击画面复位。</li>
        <li><b>场地</b>：不再默认一块方地台。可切换平地（石板 / 砖 / 夯土 / 草地 / 汉白玉）、整片湖面、湖畔（单岸）、两岸（水道 + 对岸），水面在前 / 后 / 左 / 右，并带驳岸条石与水纹；「显示场地」关掉即只出建筑。</li>
        <li><b>光照与阴影</b>：渲染面板可调「光照方位」八向与「阴影长度」，方位角同时改变受光面与投影方向，转视角时不再出现门钉糊成栅格的情况。</li>
        <li><b>直接拖动</b>：不用开关。陈设模式下鼠标按住树、假山、石灯、井、碑、幡旗、水池即可拖，松手按地面落位，配方记 <code>env.move</code>；建筑模式下按住某一栋（院落里就只挪这一栋，单栋建筑挪整栋但地面与陈设不动）也能拖到别处，配方分别记 <code>units.&lt;id&gt;.dx / dz</code> 与 <code>moveX / moveZ</code>。</li>
        <li><b>地面栅格</b>：顶栏「网格」默认开着，1 m 一格、5 格加重，X 轴偏红、Z 轴偏蓝，随旋转与缩放自动换档；格线铺在地面上、被墙体和屋顶自然遮住，只是视口辅助，导出图里没有。</li>
        <li><b>落成演示</b>：顶栏点一下，建筑按“台基 → 柱梁 → 墙面 → 屋面 → 脊饰”自下而上逐层生长（参考 <a href="https://github.com/lhlGitHub/threejs-architecture-effects" target="_blank" rel="noopener">lhlGitHub/threejs-architecture-effects</a> 的单时间线建造思路），播放中再点一次即可停止。</li>
        <li><b>配方</b>：保存的 JSON 可再次载入，或交给命令行批量出图（<code>node cli/render.js --recipe 配方.json</code>）。</li>
      </ul>
  `;

  /* 城池页追加块（只在 data-mode="city" 时出现） */
  const CITY_EXTRA = `
      <h3>城池工坊专属</h3>
      <ul>
        <li><b>城池配方</b>：标准城 / 都城·大城 / 水城·护城河 / 关城·小城 / 宫城·三殿 / 坊市·密巷，点一下整座城连同尺度一起换（100m 见方到 150m 都城）；另有从古建工坊迁来的<b>唐长安 / 洛阳 / 明清北京 / 紫禁城</b>四座名城（紫禁城 76×96m、不砌坊墙，只留中轴三殿与四角角楼）。</li>
        <li><b>预先搭设</b>：城墙（砖身收分、垛口间距/宽/高、内侧女墙）、马面（面宽 / 突出量 / 敌楼可关）、四角角楼、四座城门楼、里坊坊墙与坊门、中轴宫殿（1–3 殿 + 宫门 + 广场）、护城河与门桥；打开<b>瓮城</b>后每门外再套一圈小城（屈曲开门、正面箭楼），<b>吊桥</b>可铺木桥面或收起，全部由参数直接搭。</li>
        <li><b>随机生成</b>：街网切地块，每块按「建筑密度」落院落或单体（民居 / 厅堂 / 阁楼 / 亭 / 塔），朝向随机；同一颗种子完全可复现，「换一批城池」只换种子。</li>
        <li><b>街巷与生活层</b>：主街中间加御道石带，坊墙内侧留 L 形小巷；沿主街自动摆摊（案台 + 布棚 + 货）、幌子招牌与街灯。打开「生活层」后按密度铺开，开「夜市模式」灯更多。</li>
        <li><b>多一个 Z 轴视角</b>：舞台顶有独立的<b>俯角 Z</b> 拉条 15°–88°，从近平视一路拉到正俯视；「鸟瞰」一键到 78°，「近平视」到 16°，「中轴」把方位（Y）归 0° 转回正立面。方位按整数显示，拖动松手吸附 15°。</li>
        <li><b>像素密度</b>：城池页是 6–44 像素/米（城太大，密度再高就出不了图），默认 14；同样与「七 · 渲染与出图」里的滑杆联动。</li>
        <li><b>四向环视图</b>：0° / 90° / 180° / 270° 四帧合成一张，用来核对四面城门与城的整体气势；ZIP 里同时给出四向图、<code>sheet.png</code> 与 <code>city.json</code> 配方。</li>
        <li><b>扩一坊</b>：街网行列各加一格，城按新网格重新切分、重新落建筑。</li>
      </ul>
  `;

  /* 参考与提示：原文原样，链接全部保留 */
  const REFS = `
      <p class="muted">结构参考：B 站 <a href="https://search.bilibili.com/all?keyword=迷有事" target="_blank" rel="noopener">@迷有事</a> 的“2D 像素建筑模块化”思路（三维参数化 + 规则化算角度 + 像素化后处理），以及 <a href="https://search.bilibili.com/all?keyword=东君之桃" target="_blank" rel="noopener">@东君之桃</a> 的红楼梦院落复原（正房前廊 + 抄手游廊 + 内室隔断的宅院格局）。</p>
      <p class="muted">形制拆解（按类型对照开间、柱网与檐口，见 README「结构参考」）：塔 <a href="https://www.bilibili.com/video/BV1MqHi6gEH9/" target="_blank" rel="noopener">BV1MqHi6gEH9</a> / <a href="https://www.bilibili.com/video/BV1mJQnY3EbV/" target="_blank" rel="noopener">BV1mJQnY3EbV</a> / <a href="https://www.bilibili.com/video/BV1qY4y1w78x/" target="_blank" rel="noopener">BV1qY4y1w78x</a> / <a href="https://www.bilibili.com/video/BV1Nv9BBHE61/" target="_blank" rel="noopener">BV1Nv9BBHE61</a>；六角亭 <a href="https://www.bilibili.com/video/BV1tZ4y157v5/" target="_blank" rel="noopener">BV1tZ4y157v5</a>；八角亭 <a href="https://www.bilibili.com/video/BV1RZ4y1K7oF" target="_blank" rel="noopener">BV1RZ4y1K7oF</a>；佛殿 <a href="https://www.bilibili.com/video/BV1V8411w7MJ" target="_blank" rel="noopener">BV1V8411w7MJ</a>；县衙 <a href="https://www.bilibili.com/video/BV16HkkB4EuX" target="_blank" rel="noopener">BV16HkkB4EuX</a>；四方大殿 <a href="https://www.bilibili.com/video/BV1xU14BeEFX" target="_blank" rel="noopener">BV1xU14BeEFX</a>；道观 <a href="https://www.bilibili.com/video/BV1ka4y1L7f9" target="_blank" rel="noopener">BV1ka4y1L7f9</a>；钟鼓楼 <a href="https://www.bilibili.com/video/BV1sy4y1B78B" target="_blank" rel="noopener">BV1sy4y1B78B</a>；五开间正殿 <a href="https://www.bilibili.com/video/BV1ra411w7SL" target="_blank" rel="noopener">BV1ra411w7SL</a>；三进四合院 <a href="https://www.bilibili.com/video/BV1p44y1Q73Q/" target="_blank" rel="noopener">BV1p44y1Q73Q</a>；楼阁 <a href="https://www.bilibili.com/video/BV1GLhd6bEDm/" target="_blank" rel="noopener">BV1GLhd6bEDm</a> / 滕王阁 <a href="https://www.bilibili.com/video/BV1StGYzxEcK/" target="_blank" rel="noopener">BV1StGYzxEcK</a> / 开元寺 <a href="https://www.bilibili.com/video/BV15WJy6PEry/" target="_blank" rel="noopener">BV15WJy6PEry</a>。</p>
      <p class="muted">古建开源参考（做构件比例与新形制时的对照资料）：<a href="https://github.com/xyiqq/china-heritage-3d" target="_blank" rel="noopener">china-heritage-3d</a>、<a href="https://sketchfab.com/tags/chinese-architecture" target="_blank" rel="noopener">Sketchfab 中式建筑</a>、<a href="https://sketchfab.com/tigerofchen/collections/chinese-traditional-architecture-158e6234ff5b4a8ab4930d0956fb4493" target="_blank" rel="noopener">tigerofchen 合集</a>、<a href="https://www.cyark.org/" target="_blank" rel="noopener">CyArk</a>、<a href="https://github.com/in-a-mist/miniLibs" target="_blank" rel="noopener">miniLibs</a>、<a href="https://ip.e-dunhuang.com/" target="_blank" rel="noopener">数字敦煌</a>、<a href="https://caalib.cn/" target="_blank" rel="noopener">caalib 中国古建资料库</a>、<a href="https://github.com/Chartreuse310/chinese-architecture-wiki-online" target="_blank" rel="noopener">中国古建 wiki</a>。</p>
      <p class="muted">提示：连续导出（PNG 之后再导精灵表 / ZIP）时，Chrome 会弹一次“允许多个下载”，点允许即可；也可以用命令行批量出图，不受此限制。</p>
  `;

  /* 细部形制依据：与上面的参考条目同一写法（muted 段落 + 名称 + 取用要点） */
  const SOURCES = `
      <p class="muted">形制依据（构件比例与做法按下列资料定，梁思成两书为主）：梁思成《中国建筑史》（本地 PDF；台基—屋身—屋顶三段比例、大式与小式的斗栱有无、屋面举折、柱身收分与侧脚）、梁思成《图像中国建筑史》手绘图（本地 PDF；历代斗栱演变十三例、阑额与普拍枋演变、耍头与殿堂外观演变，敦煌唐代详图的构件名）、维基百科「中国建筑」（须弥座六层、柱础、屋顶各部名称）、<a href="https://chiculture.org.hk/tc/china-five-thousand-years/226" target="_blank" rel="noopener">中国文化研究院「中国建筑」</a>（三段论、大式有斗栱小式无、离方遁圆）、<a href="https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/arts-edu/resources/va-chinese-arts/cdi020070320d.pdf" target="_blank" rel="noopener">香港教育局《园林植物》</a>（松、竹、柳、莲、兰的形态与配置）、<a href="https://hkss.cedd.gov.hk/hkss/filemanager/en/content_120/HK-Geology-A-400-million-year-journey.pdf" target="_blank" rel="noopener">香港土木工程拓展署《HK Geology》</a>（三大岩类、层理与柱状节理、花岗岩晶粒 1–3 mm、砂岩粒径 0.06–2 mm）、<a href="https://baike.baidu.com/item/%E7%9F%B3%E5%A4%B4/805" target="_blank" rel="noopener">百度百科「石头」</a>（四大名石、瘦皱漏透丑、千层石条带、卵石磨圆）、<a href="https://pdf.hanspub.org/design202494_291181280.pdf" target="_blank" rel="noopener">陈从周园林观</a>（因地制宜、小中见大、虚实相生、借景对景；园路、花坛、水池、假山细部）。</p>
      <p class="muted">朝代做法依据（七档形制按下列条文定）：梁思成《中国建筑史》（本地 PDF；宋辽金实物一章记阑额与普拍枋——普拍枋唐初已见，北宋末尚有省而不用者如初祖庵；早者扁而宽与阑额成 T 字如薄伽教藏，后渐加厚如善化寺三圣殿与山门，至明清竟狭于阑额；玄奘塔下三层以普拍枋承斗栱、最上两层斗栱直接安于柱头，知其施用自由；元阳和楼阑额刻作假月梁形、普拍枋出头刻瓣、角柱生起显著；举折两椽小屋约二比一、殿阁约三比二，北宋末至金近三分举一）、梁思成《图像中国建筑史》手绘图（本地 PDF；历代斗栱演变与耍头、阑额普拍枋断面演变图）、宋《营造法式》材分（材广十五分、厚十分，两材之间以斗垫托为栔六分，本页斗栱缩放的量纲）。</p>
  `;


  const ACTIONS = `
      <div class="modal-actions"><button class="btn" id="btnHelpClose">知道了</button></div>
  `;

  GF.helpHTML = function (mode) {
    const title = mode === 'city' ? '城池工坊 · 使用说明' : '使用说明';
    return `<h2>${title}</h2>` + CORE + (mode === 'city' ? CITY_EXTRA : '') + REFS + SOURCES + ACTIONS;
  };

  function mount() {
    const host = document.getElementById('helpBody');
    const modal = document.getElementById('helpModal');
    if (!host) return;
    const mode = (modal && modal.dataset.mode) || 'build';
    host.innerHTML = GF.helpHTML(mode);
  }
  mount();
  GF.mountHelp = mount;
})(typeof window !== 'undefined' ? window : globalThis);

