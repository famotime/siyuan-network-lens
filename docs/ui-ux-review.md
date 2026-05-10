# 脉络镜 (Network Lens) UI/UX 审视报告

> 基于 **ui-ux-pro-max** 设计标准逐维度对照评估
>
> 审视范围：`App.vue`、`SummaryCardsGrid.vue`、`SummaryDetailSection.vue`、`SettingPanel.vue`、`FilterSelect.vue`、`OrphanDetailPanel.vue`、`RankingPanel.vue`、`AIInboxPanel.vue`、`WikiChatDialog.vue`、`WikiMaintainPanel.vue`
>
> 审视日期：2026-05-10

---

## 总体评价

脉络镜在**视觉层面已经达到了中上水准**：

- ✅ 拥有自洽的设计令牌体系（`--panel-border`、`--accent-warm/cool`、`--surface-card-*`）
- ✅ 精细的亮色/暗色主题适配（`SummaryCardsGrid` 的 light/dark 变量覆盖）
- ✅ 流畅的加载态骨架屏动画（shimmer + pulse）
- ✅ 多层级的卡片/面板布局体系
- ✅ 拖拽排序、折叠展开等进阶交互

---

## 优化进展跟踪

### 状态说明

- ✅ = 已完成
- 🔲 = 待处理

---

## §1 可访问性（Accessibility）— CRITICAL

| 规则 | 状态 | 说明 |
|------|------|------|
| `color-contrast` | 🔲 | `--panel-muted` = `on-surface 60%` 透明混合，在深色主题下文本对比度可能不足 4.5:1 |
| `focus-states` | ✅ | 已在 `index.scss` 中添加全局 `focus-visible` 基线样式 |
| `aria-labels` | ✅ | `FilterSelect` 已补充 `role="combobox"`、`aria-haspopup="listbox"`、`role="option"`、`aria-selected` |
| `keyboard-nav` | ✅ | `FilterSelect` 已实现 ArrowDown/ArrowUp/Enter/Space/Escape 键盘导航 |
| `color-not-only` | ✅ | `formatDelta` 已添加方向箭头前缀（`↑`/`↓`），不再仅靠颜色区分趋势方向 |
| `heading-hierarchy` | ✅ | `h1` → `h2` → `h3` 层级正确（原有） |
| `reduced-motion` | ✅ | 已在 `index.scss` 中添加 `@media (prefers-reduced-motion: reduce)` |

---

## §2 触控与交互（Touch & Interaction）

> **注意**：本插件为 PC 端设计，暂不考虑移动触屏优化。

| 规则 | 状态 | 说明 |
|------|------|------|
| `click-target-size` | ✅ | `summary-card__toggle` 从 20×20px 扩大到 36×36px |
| `hover-vs-tap` | ✅ | 主要交互都通过 `click` 触发，未依赖 hover（原有） |
| `loading-buttons` | ✅ | `action-button:disabled` + `cursor: progress` + 文案切换（原有） |
| `cursor-pointer` | 🔲 | `summary-detail-item__collapse-toggle` 缺少 `cursor: pointer` |
| `press-feedback` | 🔲 | 按钮没有 `:active` 按压反馈（仅有 hover 效果） |

---

## §3 性能（Performance）

| 规则 | 状态 | 说明 |
|------|------|------|
| `content-jumping` | ✅ | loading skeleton 预留了明确的尺寸空间（原有） |
| `transform-performance` | ✅ | 动画使用 `transform` + `opacity`，未动画化 `width`/`height`（原有） |
| `debounce-throttle` | 🔲 | `keyword` 输入使用 `v-model.trim` 但未见 debounce，高频输入可能触发过多筛选计算 |
| `virtualize-lists` | 🔲 | `ranking.slice(0, 12)` 做了硬截断，但 `orphanDetailItems` 列表无截断/虚拟化 |

---

## §4 风格选择（Style Selection）

| 规则 | 状态 | 说明 |
|------|------|------|
| `consistency` | ✅ | 全局统一使用同一套设计令牌（原有） |
| `no-emoji-icons` | ✅ | `WikiChatDialog` 中的 emoji（👤🤖📄➤）已全部替换为 SVG 内联图标 |
| `icon-style-consistent` | ✅ | 自定义 SVG icon 统一使用 `fill="currentColor"` 跟随主题 |
| `elevation-consistent` | ✅ | 阴影统一：`0 6px 16px -8px rgba(0,0,0,0.08)` 作为基础层级（原有） |
| `dark-mode-pairing` | ✅ | SummaryCardsGrid 有明确的 light/dark 令牌覆盖（原有） |
| `primary-action` | ✅ | 每屏一个主按钮（action-button），次要操作为 ghost-button（原有） |

---

## §5 布局与响应式（Layout & Responsive）

| 规则 | 状态 | 说明 |
|------|------|------|
| `breakpoint-consistency` | ✅ | 统一使用 `980px` 和 `720px` 两个断点（原有） |
| `horizontal-scroll` | ✅ | `min-width: 0` 和 `overflow: hidden/ellipsis` 广泛使用（原有） |
| `spacing-scale` | 🔲 | 整体遵循 4/8 步进制，但存在少量 `gap: 10px`、`gap: 14px` 等非标准值 |
| `z-index-management` | ✅ | 已在 `index.scss` 根容器定义 `--z-dropdown/popover/dialog/modal/toast` 令牌，`FilterSelect` 和 `WikiChatDialog` 已引用 |
| `scroll-behavior` | 🔲 | `.reference-analytics` 作为根容器 `overflow: auto`，某些嵌套面板可能出现双重滚动 |

---

## §6 排版与色彩（Typography & Color）

| 规则 | 状态 | 说明 |
|------|------|------|
| `line-height` | ✅ | body 类文本使用 `1.6`~`1.7`（原有） |
| `font-scale` | 🔲 | 大量 `11px`、`12px`、`13px`、`14px`、`15px` 混用，缺少明确的 type scale token |
| `color-semantic` | ✅ | 使用语义化 CSS 变量而非硬编码 hex（原有） |
| `number-tabular` | 🔲 | summary-card 数值未使用 `font-variant-numeric: tabular-nums`，数字列可能出现宽度跳动 |
| `whitespace-balance` | 🔲 | panel 内部 padding 不统一：`App.vue` 面板 `24px 8px`，`RankingPanel` 和 `AIInboxPanel` 为 `24px` |
| `truncation-strategy` | ✅ | `filter-select__summary` 使用 `text-overflow: ellipsis` + `white-space: nowrap`（原有） |

---

## §7 动画（Animation）

| 规则 | 状态 | 说明 |
|------|------|------|
| `duration-timing` | ✅ | 微交互 `0.2s`，shimmer `1.8s`，pulse `1.8s`（原有） |
| `easing` | ✅ | `ease-in-out` 用于 shimmer，`ease-out` 用于 pulse（原有） |
| `excessive-motion` | ✅ | 每个视图最多 1~2 个动画元素（原有） |
| `state-transition` | ✅ | 卡片选中态、hover 态均有平滑过渡（原有） |
| `reduced-motion` | ✅ | 已补上 `@media (prefers-reduced-motion: reduce)` |
| `exit-faster-than-enter` | 🔲 | 进出场动画使用相同时长 |
| `scale-feedback` | 🔲 | `summary-card--interactive:hover` 有 `translateY(-2px)`，但缺少 `:active` 按压反馈 |

---

## §8 表单与反馈（Forms & Feedback）

| 规则 | 状态 | 说明 |
|------|------|------|
| `input-labels` | ✅ | 所有输入框都有对应的 `<label>` 和 `<span>` 标签（原有） |
| `error-placement` | ✅ | AI 连接错误、分析错误都显示在相关区域附近（原有） |
| `submit-feedback` | ✅ | 按钮有 loading 状态文案切换（原有） |
| `empty-states` | ✅ | 有统一的 `.empty-state` 组件，提示文案友好（原有） |
| `disabled-states` | 🔲 | `action-button:disabled` = `opacity: 0.5`，但缺少语义上的 `aria-disabled` |
| `confirmation-dialogs` | 🔲 | 链接同步（`syncAssociation`）等写入操作没有确认对话框 |
| `undo-support` | 🔲 | 主题建议有 toggle（可撤销），但链接同步、批量删除等无 undo |
| `error-recovery` | 🔲 | 错误信息显示了原因，但缺少重试按钮 |
| `progressive-disclosure` | ✅ | 设置面板使用条件渲染，AI 面板支持折叠/展开（原有） |

---

## §9 导航模式（Navigation Patterns）

| 规则 | 状态 | 说明 |
|------|------|------|
| `nav-state-active` | ✅ | 当前选中的 summary card 有明确的 `--active` 视觉高亮（原有） |
| `state-preservation` | 🔲 | 切换卡片时展开/折叠状态会重置 |
| `modal-escape` | ✅ | `WikiChatDialog` 已支持 Escape 键关闭 |
| `overflow-menu` | ✅ | 操作按钮数量可控，未出现拥挤（原有） |

---

## §10 图表与数据（Charts & Data）

| 规则 | 状态 | 说明 |
|------|------|------|
| `empty-data-state` | ✅ | 每个列表/网格都有空状态提示（原有） |
| `number-formatting` | 🔲 | 大数值未做千分位格式化 |
| `data-density` | ✅ | ranking 限制 12 条，趋势限制 5 条（原有） |

---

## 跨组件系统性问题

### 问题 1：CSS 重复定义严重 — 🔲 待处理

相同的样式在多个组件中重复定义（如 `.action-button`、`.ghost-button`、`.panel-toggle`、`.badge`、`.empty-state`），至少在以下文件中出现了独立声明：

- `App.vue`
- `SummaryCardsGrid.vue`
- `SummaryDetailSection.vue`
- `RankingPanel.vue`
- `AIInboxPanel.vue`
- `WikiChatDialog.vue`

> ⚠️ 当前的 scoped CSS 导致每个组件都必须重复基础样式。修改一处时容易遗漏其他副本，导致视觉不一致。

**建议**：将共享样式抽取为全局 CSS layer 或通过组件封装：

```
src/
  styles/
    tokens.css       ← 设计令牌
    components.css    ← 共享组件样式（button, badge, panel, empty-state）
    animations.css    ← shimmer, pulse 等
```

### 问题 2：面板内边距不一致 — 🔲 待处理

| 组件 | padding |
|------|---------|
| `App.vue .panel` | `24px 8px` |
| `RankingPanel .panel` | `24px` |
| `AIInboxPanel .panel` | `24px` |

水平方向 `8px` vs `24px` 的不一致导致内容边缘对齐不齐。

### 问题 3：SiyuanTheme 组件未被使用 — 🔲 待决策

`src/components/SiyuanTheme/` 目录下有 `SyButton`、`SyCheckbox`、`SyInput`、`SySelect`、`SyTextarea` 等组件，但未在任何地方使用。如果这些是计划中的统一组件，应加速推进替换；如果已废弃，应清理。

---

## 优先级排序的行动清单

| 优先级 | 行动项 | 状态 | 涉及文件 | 工作量 |
|--------|--------|------|---------|--------|
| 🔴 P0 | 补 `prefers-reduced-motion` | ✅ | `index.scss` | 小 |
| 🔴 P0 | 扩大 `summary-card__toggle` 点击区域到 ≥32px | ✅ | `SummaryCardsGrid.vue`, `App.vue` | 小 |
| 🔴 P0 | 替换 WikiChatDialog 中的 emoji 为 SVG icon | ✅ | `WikiChatDialog.vue` | 中 |
| 🟡 P1 | 为所有交互元素补 `:focus-visible` 样式 | ✅ | `index.scss` | 中 |
| 🟡 P1 | FilterSelect 补键盘导航和 ARIA 语义 | ✅ | `FilterSelect.vue` | 中 |
| 🟡 P1 | 趋势 delta 补方向标识符（↑/↓） | ✅ | `use-analytics.ts`, `SummaryDetailSection.test.ts` | 小 |
| 🟡 P1 | 统一 z-index 层级体系 | ✅ | `index.scss`, `FilterSelect.vue`, `WikiChatDialog.vue` | 小 |
| 🟡 P1 | WikiChatDialog 添加 Escape 键关闭 | ✅ | `WikiChatDialog.vue` | 小 |
| 🟢 P2 | 抽取共享样式为全局 CSS | 🔲 | 新建 `styles/` 目录 | 大 |
| 🟢 P2 | 定义统一 type scale（font-size token 化） | 🔲 | 全局 token | 中 |
| 🟢 P2 | 数值显示加 `tabular-nums` | 🔲 | 卡片组件 | 小 |
| 🟢 P2 | 统一 panel padding | 🔲 | `App.vue`、各面板组件 | 小 |
| 🟢 P2 | 破坏性操作添加确认对话框 | 🔲 | `RankingPanel` 等 | 中 |
| 🟢 P2 | 错误状态添加重试按钮 | 🔲 | `App.vue` | 小 |
| ⚪ P3 | keyword 输入添加 debounce | 🔲 | `App.vue` / composable | 小 |
| ⚪ P3 | 统一间距为 4/8 步进制 | 🔲 | 全局 | 中 |
| ⚪ P3 | 添加 `:active` 按压反馈 | 🔲 | 全局按钮样式 | 小 |
| ⚪ P3 | 清理或推进 SiyuanTheme 组件 | 🔲 | `SiyuanTheme/` | 决策 |

---

## 变更记录

### 2026-05-10 — P0 + P1 全部完成

已完成的修改清单：

| 文件 | 修改内容 |
|------|---------|
| `src/index.scss` | 添加 `prefers-reduced-motion` 媒体查询、全局 `focus-visible` 基线样式、z-index 层级令牌 |
| `src/components/SummaryCardsGrid.vue` | toggle 按钮从 20→36px，图标从 10→12px |
| `src/App.vue` | toggle 按钮同步扩大到 36px（与 SummaryCardsGrid 一致） |
| `src/components/WikiChatDialog.vue` | 5 处 emoji 替换为 SVG、添加 Escape 键关闭、z-index 改用令牌、添加 `inline-icon` 样式 |
| `src/components/FilterSelect.vue` | 添加 ARIA 语义（combobox/listbox/option）、完整键盘导航、高亮跟踪、z-index 令牌引用 |
| `src/composables/use-analytics.ts` | `formatDelta` 添加方向箭头前缀 `↑`/`↓` |
| `src/components/SummaryDetailSection.test.ts` | 同步 `formatDelta` mock 实现 |

所有修改已通过 **401 项测试** 和 **生产构建**。
