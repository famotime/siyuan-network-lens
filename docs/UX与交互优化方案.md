# 思源笔记“脉络镜”插件 UI 与交互深度优化方案

作为一款定位为**“文档级引用网络诊断与知识结构维护”**的高效生产力工具，“脉络镜（Network lens）”在日常被用户频繁使用。为了让其视觉美感、操作效率以及环境融入度达到互联网成熟应用的顶尖水平，本方案从资深 UI/UX 设计师视角出发，针对当前项目在**字体、配色、图标防冲突、高频交互屏效**等方面存在的问题进行了深度审视，并提供了可落地的高清设计指导。

---

## 1. 场景约束与设计哲学 (Scene Constraints & Philosophy)

“脉络镜”通常作为思源笔记的**侧边栏（Dock 面板）**或**辅助页签**存在。这带来了三大物理级约束：

1. **窄屏限制（屏效比是生命线）**：侧栏宽度通常在 `240px - 360px` 之间，任何长文本按钮（如“生成文档索引”、“同步为内部链接”）都会导致剧烈的换行或撑破容器，产生严重的认知负荷与视觉杂乱。
2. **主题多变（自适应是基石）**：思源笔记拥有庞大的第三方主题生态，日间、夜间、护眼、极简等皮肤的底色、高亮色千千百百。插件必须**完全剔除硬编码颜色**，依托思源底层语义化 Token。
3. **高频操作（摩擦力最小化）**：用户在整理引用、查看 AI 建议时是一个重复的流式动作。操作路径必须极其简短，反馈应当即时且带有精细的物理动效。

---

## 2. 当前核心 UI/UX 问题诊断 (As-Is Audit)

### 🚨 问题一：线框图标在特定主题下“崩坏”（实心墨点化）
*   **痛点描述**：当用户切换到某些第三方主题时，原本清爽的线框（Outline）图标（如卡片切换、链接关联）突然变成了**一大团纯黑色块**，完全失去了线条细节。
*   **技术根源**：思源或第三方主题的全局 CSS 中往往为了省事定义了类似 `svg { fill: currentColor; }` 或 `svg * { fill: currentColor !important; }` 的粗暴规则。这直接把我们原本设置为 `fill="none"` 的线框图标的背景填充满了。
*   **视觉危害**：导致界面极其简陋，产生严重的视觉廉价感。

### 🚨 问题二：长字按钮扎堆，排版极度拥挤且易折行
*   **痛点描述**：详情面板（`SummaryDetailSection.vue`）和设置面板中存在大量纯文本按钮，如 `[生成文档索引]`、`[查看文档索引]`、`[同步为内部链接]`。
*   **视觉危害**：在窄屏下，这些字样会被强行折行（如“生成文档\n索引”），使本就局促的卡片信息流显得凌乱不堪，对齐关系支离破碎，缺乏现代专业软件的精致与从容。

### 🚨 问题三：无障碍提示（Tooltip）缺失与交互不确定性
*   **痛点描述**：部分图标按钮虽然起到了精简界面的作用，但缺乏悬浮时的即时 Tooltip 提示，或者提示文字（`title` 属性）未统一国际化，甚至由于原生 `title` 的弹出延迟，导致用户需要“盲猜”按钮功能。
*   **交互危害**：阻碍了用户的操作直觉，容易造成误触和操作畏惧。

### 🚨 问题四：暗色模式下的色彩对比度与层级偏离
*   **痛点描述**：部分面板卡片的背景、边框和状态标记使用了 ad-hoc 的灰色或带透明度的纯色。在切换到深色主题后，由于没有遵循 WCAG 2.1 对比度规范（文本 ≥ 4.5:1，图标 ≥ 3:1），部分辅助文字几不可见，层级混乱。

---

## 3. 优化与重构方案 (To-Be Recommendations)

### 🎯 方案一：SVG 显式线框防覆盖规范（P0 级视觉保障）
为彻底解决思源主题全局覆盖 `fill` 的顽疾，**所有线框类图标必须在 `<svg>` 标签上声明显式内联样式防覆盖**。

#### 🛠️ 技术标准：
1.  **强制内联 `style="fill:none!important"`**。由于 inline style 结合 `!important` 具有 CSS 树中最高的声明优先级，能够完全御敌于外。
2.  **笔画控制**：使用 `stroke="currentColor"` 来保持与当前环境文字颜色一致，并统一笔画宽度（推荐 `stroke-width="1.6"` 或 `1.8`，避免过粗或过细）。
3.  **防畸变**：设置 `stroke-linecap="round"` 和 `stroke-linejoin="round"` 以确保在不同 DPI 下平滑渲染。

#### 💻 黄金代码模板：
```html
<!-- 优化前 -->
<svg class="custom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path d="..." />
</svg>

<!-- 优化后：注入显式线框防护层，并规范线宽与对齐 -->
<svg 
  style="fill:none!important; display:inline-block; vertical-align:middle;" 
  viewBox="0 0 24 24" 
  stroke="currentColor" 
  stroke-width="1.6" 
  stroke-linecap="round" 
  stroke-linejoin="round"
  class="custom-icon"
  aria-hidden="true"
>
  <path d="M12 5v14M5 12h14" /> <!-- 示例线框 path -->
</svg>
```

---

### 🎯 方案二：高频操作“按钮转直观图标 + Tooltip”（P1 级效率重构）
我们将详情流、卡片区以及配置页里的长中文文本按钮，升级为**“紧凑线框图标 + 智能 Tooltip”**设计。这能使原本 `100px+` 的按钮区域瞬间缩减至 `32px`，支持多项操作在一行并排排列。

#### 🔄 操作重构映射表：

| 现有文本按钮 | 推荐线框图标 (Lucide 风格) | 图标样式表现 | 智能 Tooltip 提示内容 | 设计意图与屏效增益 |
| :--- | :--- | :--- | :--- | :--- |
| **生成文档索引** | `Sparkles` (星火) | 闪电星芒线框 | `生成文档 AI 摘要与索引` | 传达 AI 赋能的科技感，腾出卡片底栏空间 |
| **查看文档索引** | `FileText` (文档) | 纸张带线条线框 | `查看已生成的 AI 文档索引` | 替代文字，提供清晰的阅读导向 |
| **同步为内部链接** | `Link` (链接) | 45度倾斜双环线框 | `将该关联同步写入文档内部链接` | 突出“写入”和“链接”的实际动作 |
| **撤销链接建议** | `Link2Off` (断链) | 带斜线的双环线框 | `撤销已写入的链接建议` | 与 Link 形成动作对比，具备安全警示防误触 |
| **标记为已读** | `CheckCircle2` (勾选) | 圆圈内带勾线框 | `将此文档标记为已读` | 极简操作，一键归档已读 |
| **配置导入/导出** | `Upload` / `Download` | 向上/向下的箭头托盘 | `导入配置 JSON` / `导出配置 JSON` | 消除配置面板的横向拉伸，使其精致紧凑 |

---

### 🎯 方案三：轻量化 Tooltip 交互系统
为了保证在没有文字按钮时的易用性，必须为所有图标按钮挂载 Tooltip。

1.  **属性基准**：对不需要复杂排版的普通按钮，使用 `:title="t('key')"`。
2.  **思源适配**：结合思源的 `aria-label` 悬浮提示，为按钮添加思源全局样式类：
    ```html
    <button 
      class="aria-readonly tooltip-trigger" 
      :aria-label="t('tooltipText')"
      type="button"
    >
      <svg style="fill:none!important" ...>...</svg>
    </button>
    ```
    思源会自动拦截 `aria-label` 并渲染出原生且高颜值的轻量 Tooltip，实现与思源主体界面 100% 的视觉契合。

---

### 🎯 方案四：字体与排版层级调优（Typography System）
*   **字体继承**：切忌硬编码任何特定的中文字体族（如 `微软雅黑`, `PingFang`）。统一使用 `font-family: inherit;`，完全继承思源主程序设置好的系统字体（如思源内置的系统默认、细体等）。
*   **字阶缩放（Type Scale）**：
    *   主标题 / 统计数字：`--text-2xl` (`24px`) 或 `--text-xl` (`20px`)，使用粗体 (`600`)。
    *   卡片标题 / 二级标题：`--text-base` (`14px`)，中粗体 (`500`)。
    *   正文 / 详情段落：`--text-sm` (`12px`)，普通字重 (`400`)，行高强制设为 `1.6`（防止多行文本折叠时粘连）。
    *   元数据 / 提示旁白：`--text-xs` (`11px`)，字色使用 `--b3-theme-text-muted`。

---

## 5. 配色系统与状态反馈（Micro-Interactions）
全面拥抱思源笔记 CSS 变量，引入 `color-mix` 丰富微交互。

```scss
/* 交互状态规范 */
.action-icon-btn {
  /* 基础态：继承思源静默色，大小紧凑 */
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* 悬停态：使用思源主色(Primary)的10%透明度混色 */
  &:hover:not(:disabled) {
    color: var(--b3-theme-primary);
    background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  }
  
  /* 点击态（物理反馈）：微缩放 */
  &:active:not(:disabled) {
    transform: scale(0.92);
    background: color-mix(in srgb, var(--b3-theme-primary) 18%, transparent);
  }
  
  /* 禁用态：降低透明度，禁用指针 */
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    color: var(--b3-theme-text-muted) !important;
    background: transparent !important;
  }
}
```

---

## 6. 重点文件改造指南 (Implementation Guide)

### 📌 组件 1：`src/components/SummaryDetailSection.vue`
*   **当前做法**：生成索引和查看索引使用长文本 Button。
*   **重构方案**：
    1. 将 `doc-index-actions` 改造为紧凑的工具栏。
    2. 将“生成索引”改写为带有 `Sparkles` 图标的 `.action-icon-btn`。
    3. 将“查看索引”改写为带有 `FileText` 图标 of `.action-icon-btn`。
    4. 挂载 `aria-label` 提示。
    5. 重构卡片中关联分析列表的“同步/撤销”操作，使用线框的 `Link` / `Link2Off` 图标。

### 📌 组件 2：`src/components/SettingPanel.vue`
*   **当前做法**：配置备份、配置导入有冗长按钮。
*   **重构方案**：
    1. 在配置字段的尾部使用 `Upload` 和 `Download` 按钮组。
    2. 使用 `style="fill:none!important"` 包裹导入导出的 SVG，防止图标在自定义主题下变为纯黑色块。

---

## 7. 验证与验收规范 (Verification & QA)

1.  **主题兼容性验收**：
    *   测试在**思源明亮默认主题**、**思源暗黑默认主题**下，所有 SVG 图标是否依然清晰呈现，无背景填充畸变。
    *   引入至少一款具有强力全局 CSS 覆盖的第三方主题（如带有 `svg { fill: currentColor }` 的主题）进行测试，确保我们的 SVG 线框图标由于内联 `style="fill:none!important"` 而安然无恙。
2.  **屏效比宽度验收**：
    *   在思源侧栏中，将 Dock 栏宽度拉至最小值 `240px`。
    *   检查此时详情卡片内的操作区（如大文档卡片、孤立文档补链卡片）是否全部能够单行放下，没有出现文字折行或横向滚动条。
3.  **交互反馈验收**：
    *   悬停（hover）在任意图标按钮上，应能在 150ms 内浮现清晰的中文 Tooltip。
    *   点击（active）时，应伴随 8% 左右的微缩放效果，动画时间在 `150ms` 左右，且无任何排版抖动（Layout Shift）。
