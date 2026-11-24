# 源码模块边界

项目要支持 `file://` 双击直开，因此不能直接用 ES Modules。界面与装配源码按业务边界拆在 `src/`，由 `tools/build.js` 按固定顺序合回一个 IIFE 运行包。

**不要直接修改运行包**：`js/app.js`、`js/city-app.js`、`js/gf-build.js` 文件头都标了 `AUTO-GENERATED`。

```bat
node tools/build.js
node tools/build.js --check
```

`--check` 只校验运行包是否与 `src/` 一致，不写文件，适合提交前检查。

## 古建页 `src/ancient-ui/ → js/app.js`

| 文件 | 业务边界 |
| --- | --- |
| `00-shell.js` | 页面壳、全局状态、画布、GPU/网格偏好、模式与网格按钮 |
| `10-env-editor.js` | 陈设组件条、组件落位与选中、陈设编辑面板 |
| `20-building-editor.js` | 建筑本体第二套选择栏、按台基/逐层/屋面分段编辑、路径读写 |
| `30-controls.js` | 左侧控件定义、建筑类型、预设/随机、控件渲染与同步 |
| `40-render.js` | 渲染参数、预览预算、重建与完整预览 |
| `50-camera.js` | 俯角/透视滑条、相机轻量帧、提交与取消 |
| `60-demo.js` | 落成演示时间线、播放/停止 |
| `70-grid.js` | 世界米制地面网格、透视反算、线段比例尺、内容包围盒 |
| `80-drag.js` | 陈设选中/拖动/碰撞与建筑拖动 |
| `90-interactions.js` | 画布旋转/平移/缩放、双击复位、键盘快捷键 |
| `95-export.js` | PNG、八向精灵表、ZIP、配方保存/载入 |
| `97-events.js` | DOM 事件绑定与控件联动 |
| `99-boot.js` | 启动顺序（构建控件、同步、绑定、重建） |

## 城池页 `src/city-ui/ → js/city-app.js`

| 文件 | 业务边界 |
| --- | --- |
| `00-shell.js` | 页面壳、城池状态、画布与 GPU 偏好 |
| `10-controls.js` | 城制控件、路径读写、控件构建/同步、密度联动、相机信息 |
| `20-render.js` | 预览预算、完整/轻量帧、动态画幅、布局、俯角/透视滑条、重建 |
| `30-interactions.js` | 左键拖视角、滚轮缩放、拖动结束 |
| `40-export.js` | 城池 PNG、配方保存/载入 |
| `50-ancient-import.js` | 古建配方入城：快速预设、JSON 导入、列表/删除 |
| `60-events.js` | 顶部/侧栏/城制面板事件、页签与按钮绑定 |
| `70-boot.js` | 启动顺序 |

## 建筑装配 `src/ancient-build/ → js/gf-build.js`

| 文件 | 业务边界 |
| --- | --- |
| `00-common.js` | 地面/室内地板、主体结构、副阶、台基栏杆、室内陈设 |
| `10-dwellings.js` | 穴居、殿/堂、民居、亭、塔 |
| `20-gates.js` | 牌坊、城门楼/城台券洞、游廊、单栋房屋与多建筑登记 |
| `30-courtyard.js` | 宅院入口与院落装配入口 |
| `40-layout.js` | 院落布局共用：院落骨架、房屋/游廊摆放、台基与轴线 |
| `50-compounds.js` | 寺五进、道观、五进院、廊院、贾府等复合院落 |
| `60-garden.js` | 廊桥、阁、水榭、画舫/石舫、阙、长廊、露台、环境陈设 |
| `70-city.js` | 城垣、城门、马面、角楼、里坊、中轴宫殿、护城河 |
| `80-assembly.js` | `GF.build` 总装与 builders 导出 |

## 保持模块边界

- 新增界面行为放进对应业务模块，不往 `00-shell.js` 里堆全局逻辑。
- 跨模块函数目前共享同一个构建闭包；模块顺序由 `tools/build.js` 的 `files` 列表固定，不要任意调换。
- 修改后必须跑 `node tools/build.js` 和 `node tools/build.js --check`。
- 新增模块时，在 `tools/build.js` 中按依赖顺序插入，并同步更新本文件。
