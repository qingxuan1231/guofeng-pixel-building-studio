# 源码模块边界

项目要支持 `file://` 双击直开，所以 `src/` 下的每个文件都是一个**独立 classic script**，由 HTML 按顺序直接加载，不使用 ES Modules，也不需要构建或本地服务。

## 加载规则

- 每个模块文件顶部有 `'use strict';`。
- 同一页面的所有模块共享全局词法作用域。`GF` 在 `src/ancient-build/00-common.js` 里用 `var GF = (window.GF = window.GF || {});` 定义，界面模块不再重复声明 `const GF`。
- 模块顺序固定：先核心库，再装配模块，最后界面模块；启动代码在最后一个界面模块里执行。
- 同一页面内，顶层 `const` / `let` 名字不能重复，否则后加载的脚本会 SyntaxError。
- 模块是普通脚本，不是 ES Module；不要给 `<script>` 加 `type="module"`，`file://` 下会被浏览器拦截。

## 古建页 `index.html`

| 文件 | 业务边界 |
| --- | --- |
| `src/ancient-build/00-common.js` | 地面/室内地板、主体结构、副阶、台基栏杆、室内陈设；定义全局 `GF` |
| `src/ancient-build/10-dwellings.js` | 穴居、殿/堂、民居、亭、塔 |
| `src/ancient-build/20-gates.js` | 牌坊、城门楼/城台券洞、游廊、单栋房屋与多建筑登记 |
| `src/ancient-build/30-courtyard.js` | 宅院入口与院落装配入口 |
| `src/ancient-build/40-layout.js` | 院落布局共用：院落骨架、房屋/游廊摆放、台基与轴线 |
| `src/ancient-build/50-compounds.js` | 寺五进、道观、五进院、廊院、贾府等复合院落 |
| `src/ancient-build/60-garden.js` | 廊桥、阁、水榭、画舫/石舫、阙、长廊、露台、环境陈设 |
| `src/ancient-build/70-city.js` | 城垣、城门、马面、角楼、里坊、中轴宫殿、护城河 |
| `src/ancient-build/80-assembly.js` | `GF.build` 总装与 builders 导出 |
| `src/ancient-ui/00-shell.js` | 页面壳、全局状态、画布、GPU/网格偏好、模式与网格按钮 |
| `src/ancient-ui/10-env-editor.js` | 陈设组件条、组件落位与选中、陈设编辑面板 |
| `src/ancient-ui/20-building-editor.js` | 建筑本体选择栏、按台基/逐层/屋面分段编辑、路径读写 |
| `src/ancient-ui/30-controls.js` | 左侧控件定义、建筑类型、预设/随机、控件渲染与同步 |
| `src/ancient-ui/40-render.js` | 渲染参数、预览预算、重建与完整预览 |
| `src/ancient-ui/50-camera.js` | 俯角/透视滑条、相机轻量帧、提交与取消 |
| `src/ancient-ui/60-demo.js` | 落成演示时间线、播放/停止 |
| `src/ancient-ui/70-grid.js` | 世界米制地面网格、透视反算、线段比例尺、内容包围盒 |
| `src/ancient-ui/80-drag.js` | 陈设选中/拖动/碰撞与建筑拖动 |
| `src/ancient-ui/90-interactions.js` | 画布旋转/平移/缩放、双击复位、键盘快捷键 |
| `src/ancient-ui/95-export.js` | PNG、八向精灵表、ZIP、配方保存/载入 |
| `src/ancient-ui/97-events.js` | DOM 事件绑定与控件联动 |
| `src/ancient-ui/99-boot.js` | 启动顺序（构建控件、同步、绑定、重建） |

## 城池页 `city.html`

城池页复用 `src/ancient-build/` 的 9 个装配模块，并加载 `js/gf-city.js` 生成城池；界面模块如下：

| 文件 | 业务边界 |
| --- | --- |
| `src/city-ui/00-shell.js` | 页面壳、城池状态、画布与 GPU 偏好 |
| `src/city-ui/10-controls.js` | 城制控件、路径读写、控件构建/同步、密度联动、相机信息 |
| `src/city-ui/20-render.js` | 预览预算、完整/轻量帧、动态画幅、布局、俯角/透视滑条、重建 |
| `src/city-ui/30-interactions.js` | 左键拖视角、滚轮缩放、拖动结束 |
| `src/city-ui/40-export.js` | 城池 PNG、配方保存/载入 |
| `src/city-ui/50-ancient-import.js` | 古建配方入城：快速预设、JSON 导入、列表/删除 |
| `src/city-ui/60-events.js` | 顶部/侧栏/城制面板事件、页签与按钮绑定 |
| `src/city-ui/70-boot.js` | 启动顺序 |

## 增删模块

1. 新建模块文件，顶部写 `'use strict';`。
2. 在 `index.html` 或 `city.html` 的脚本列表里按依赖顺序插入 `<script src="...">`。
3. 同步更新 `cli/modules.js`，命令行渲染和审计也按同一顺序加载。
4. 重要：不要在同一页面的不同模块里重复声明同名顶层 `const` / `let`。
5. 改完直接刷新页面；没有构建步骤。批量改完可跑 `node cli/audit.js` 做控件回归。
