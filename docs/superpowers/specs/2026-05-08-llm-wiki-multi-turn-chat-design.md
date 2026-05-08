# LLM Wiki 多轮对话聊天窗口设计

## 概述

将现有的 WikiChatDialog 从单次问答改造为标准多轮 AI 聊天窗口：气泡消息、头像、底部输入、@提及切换来源、多轮上下文、整对话保存。

## 需求确认

| 项目 | 决策 |
|------|------|
| 路由策略 | 仅首轮路由，后续追问保持同一来源，除非用户 @ 切换 |
| @ 切换交互 | 替换模式：选中后移除 @xxx，来源栏更新，输入框只保留问题文本 |
| 切换后历史 | 保留历史记录作为上下文发送给 AI |
| 保存方式 | 保存整个对话为一个 SiYuan 文档 |
| 主题适配 | 使用 SiYuan CSS 变量（`var(--b3-theme-*)`），零硬编码颜色 |
| 上下文消息数 | 遵循设置页 `aiMaxContextMessages` 配置 |

## 1. 数据模型

### ChatMessage — 单条消息

```ts
interface ChatMessage {
  id: string                         // uuid，用于列表 key
  role: 'user' | 'assistant' | 'system'
  content: string                    // 消息文本
  timestamp: number                  // Date.now()
  sourcePage?: WikiIndexPage         // 该消息使用的 Wiki 来源（assistant 消息必有）
  referencedDocumentIds?: string[]   // AI 引用的文档 ID
  isRouting?: boolean                // 标记"正在路由"的过渡消息
  sourceSwitched?: boolean           // 标记来源切换的系统提示
  switchFrom?: string                // 切换前的来源标题
  switchTo?: string                  // 切换后的来源标题
}
```

### WikiChatSession — 会话状态

```ts
interface WikiChatSession {
  messages: ChatMessage[]                     // 完整消息历史
  currentSourcePage: WikiIndexPage | null     // 当前 Wiki 来源
  isRouting: boolean                          // 正在执行路由匹配
  isLoading: boolean                          // 正在等待 AI 回复
  error: string | null                        // 错误信息
}
```

### 与现有类型的关系

- **替换**：`WikiChatResult` 被 `ChatMessage[]` 取代
- **保留**：`WikiChatScope`（初始打开时的模式判断）、`WikiIndexPage`（来源页面类型）
- **扩展**：`llm-wiki-chat-service.ts` 新增多轮上下文构建函数

## 2. Composable 层 — `use-wiki-chat-session.ts`

### 新建文件：`src/composables/use-wiki-chat-session.ts`

```ts
interface WikiChatSessionController {
  // 响应式状态
  session: Ref<WikiChatSession>
  inputText: Ref<string>
  mentionPopupVisible: Ref<boolean>
  mentionFilter: Ref<string>
  filteredPages: ComputedRef<WikiIndexPage[]>

  // 操作方法
  sendMessage(): Promise<void>
  switchSource(page: WikiIndexPage): void
  resetSession(): void
  buildSaveMarkdown(): string
}
```

### sendMessage 核心流程

```
sendMessage():
  1. 解析输入文本，检测是否包含 @ 切换指令
     ├─ 有 @xxx → switchSource(匹配页面)，从文本中移除 @xxx
     └─ 无 @ → 保持当前来源

  2. 创建 user ChatMessage，push 到 session.messages

  3. 判断是否需要路由（两步路由）
     ├─ currentSourcePage 已有值 → 跳过路由，直接进入步骤 4
     └─ currentSourcePage 为 null（topic 模式首次消息）
       → 插入 isRouting=true 的系统消息
       → 调用 AI 路由：buildRouteSystemPrompt + buildRouteUserPrompt
       → 匹配返回的标题 → 更新 currentSourcePage
       → 更新系统消息为"来源已确定: xxx"

  4. 获取 currentSourcePage 的 kramdown 内容

  5. 构建多轮上下文消息数组
     ├─ system message: buildChatSystemPrompt()
     ├─ wiki context: buildWikiContextMessage(pageTitle, kramdown)
     ├─ 历史消息: 取最近 N 条（N = config.aiMaxContextMessages × 2）
     │   └─ 包含来源切换后的所有消息（保留历史）
     └─ 当前 user message

  6. 调用 AI chat endpoint（POST /chat/completions）

  7. 解析响应 → 创建 assistant ChatMessage
     ├─ 填充 sourcePage = currentSourcePage
     ├─ 填充 referencedDocumentIds
     └─ push 到 session.messages

  8. 清空 inputText
```

### @ 提及检测逻辑

```ts
watch(inputText, (text) => {
  const cursorPos = textareaRef.value?.selectionStart ?? text.length
  const beforeCursor = text.slice(0, cursorPos)
  const atMatch = beforeCursor.match(/@([^@\s]*)$/)

  if (atMatch) {
    mentionFilter.value = atMatch[1]
    mentionPopupVisible.value = true
  } else {
    mentionPopupVisible.value = false
  }
})

// filteredPages:
//   wikiPages.filter(p =>
//     p.title.toLowerCase().includes(mentionFilter.value.toLowerCase())
//   ).slice(0, 8)

switchSource(page):
  inputText.value = inputText.value.replace(/@[^@\s]*\s?/, '')
  mentionPopupVisible.value = false
  session.value.currentSourcePage = page
  messages.push({
    role: 'system',
    content: `来源已切换: ${oldTitle} → ${page.title}`,
    sourceSwitched: true,
    switchFrom: oldTitle,
    switchTo: page.title
  })
```

### 上下文窗口构建

```ts
buildContextMessages(systemPrompt, wikiContext, history, currentMsg):
  maxContext = config.aiMaxContextMessages ?? 1
  // maxContext = 1 → 取最近 1 轮（user + assistant 共 2 条）
  // maxContext = 3 → 取最近 3 轮（6 条）

  recentHistory = history.slice(-(maxContext * 2))
    .filter(m => m.role === 'user' || m.role === 'assistant')

  return [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: wikiContext },  // Wiki 页面内容
    ...recentHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: currentMsg }
  ]
```

Wiki 页面内容作为独立的 system message 发送，每次请求都包含最新的页面内容。历史消息中跳过 system 类型（路由提示、切换提示），只保留 user/assistant 对话。

## 3. UI 组件结构

### WikiChatDialog.vue（重写为纯 UI 壳层）

所有逻辑委托给 `useWikiChatSession()`，组件只负责模板渲染和事件绑定。

模板 6 个区域：

1. **Header** — 标题 + 关闭按钮
2. **SourceBar** — 当前来源栏（`📄 来源` 标签 + 页面标题 + 切换链接）
3. **Messages** — 消息气泡列表
   - 系统消息（路由/切换提示）：居中灰色文本
   - 用户消息气泡：靠右，蓝色背景，用户头像 + 时间戳
   - AI 消息气泡：靠左，深色背景，机器人头像 + 时间戳 + 来源标签
4. **MentionPopup** — @ 候选列表（条件渲染，最多 8 条，点击选中）
5. **InputArea** — textarea + 发送按钮（Enter 发送，@ 触发弹窗）
6. **Footer** — 保存整个对话按钮（有消息时显示）

### 样式策略

全部使用 SiYuan CSS 变量，零硬编码颜色：

```scss
.wiki-chat-dialog {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-surface);
}
.bubble-user .bubble-content {
  background: var(--b3-theme-primary-lightest);
}
.bubble-assistant .bubble-content {
  background: var(--b3-theme-surface-light);
}
.source-tag {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
}
.source-badge {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-primary, #fff);
}
.system-hint {
  color: var(--b3-theme-on-surface-light);
}
.mention-popup {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
}
.input-area textarea {
  background: var(--b3-theme-surface-light);
  border: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-surface);
}
```

## 4. 两步路由流程

### 消息生命周期

```
用户发送消息
    │
    ▼
解析输入，检测 @ 指令
├─ 有 @xxx → switchSource
└─ 无 @ → 保持当前来源
    │
    ▼
currentSourcePage 有值？
├─ YES → 跳过路由，直接 AI 问答
└─ NO (topic 模式首次)
    │
    ▼
步骤 1: AI 路由匹配
  插入系统消息: "🔍 正在匹配最佳 Wiki 页面..."
  调用 AI: route prompt + 问题 + 页面列表
  返回标题 → 模糊匹配页面
  更新 currentSourcePage
  更新系统消息: "✅ 答复来源: xxx"
    │
    ▼
步骤 2: AI 问答
  构建上下文: system prompt + wiki 内容 + 历史 + 当前问题
  调用 AI → 解析响应
  创建 assistant ChatMessage (含 sourcePage + referencedDocumentIds)
  push 到 session.messages
  自动滚动到底部
```

### @ 切换时序

```
用户输入: "@神经网络架构 这个和CNN有什么关系？"
    │
    ▼
watch 检测到 @，弹出候选列表
用户选择 "神经网络架构-llm-wiki"
    │
    ▼
switchSource():
  1. inputText → "这个和CNN有什么关系？" (移除 @xxx)
  2. 关闭弹窗
  3. currentSourcePage → 神经网络架构页面
  4. 插入系统消息: "🔄 来源已切换: 深度学习基础 → 神经网络架构-llm-wiki"
    │
    ▼
用户点击发送
  currentSourcePage 已有值 → 跳过路由 → 直接 AI 问答
  使用新来源的 kramdown 内容
  历史消息保留（包含之前基于深度学习基础的对话）
```

## 5. 对话保存

### Markdown 输出格式

```markdown
# Wiki AI 对话记录
> 对话时间: 2026-05-08 14:32
> 初始来源: 深度学习基础-llm-wiki

---

## Q1: 什么是反向传播？

> 📄 来源: [深度学习基础-llm-wiki](siyuan://blocks/xxx)

反向传播是深度学习的核心算法...

---

## Q2: 这个和CNN有什么关系？（来源已切换）

> 📄 来源: [神经网络架构-llm-wiki](siyuan://blocks/yyy)

CNN 是一种特殊的神经网络架构...
```

- **保存位置**：`/{wikiContainerName}/Chat/{对话标题}.md`
- **反向链接**：在每个引用的 Wiki 页面末尾追加引用块
- **对话标题**：取第一条用户消息（截取前 30 字符）

## 6. 文件变更清单

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/composables/use-wiki-chat-session.ts` | 会话状态管理：消息历史、路由判断、@ 检测、上下文构建、保存 Markdown 生成 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/components/WikiChatDialog.vue` | 重写模板（气泡消息列表 + 来源栏 + @ 弹窗 + 底部输入）；脚本委托给 `useWikiChatSession()`；样式全量使用 `var(--b3-theme-*)` |
| `src/analytics/llm-wiki-chat-service.ts` | 新增 `buildWikiContextMessage()`；保留现有 prompt builder 和 parser |
| `src/composables/use-analytics-llm-wiki-chat.ts` | 移除 `buildChatSaveMarkdown()`（迁移到 session composable）；新增 `chatSession` ref |
| `src/App.vue` | 适配 WikiChatDialog 新 props；适配对话级保存格式 |
| `src/i18n/ui.ts` | 新增聊天气泡、来源栏、@弹窗、路由提示、保存按钮等 i18n 键 |

### 不变的文件

- `src/analytics/wiki-index.ts` — WikiIndexPage 类型不变
- `src/types/config.ts` — aiMaxContextMessages 已存在
- `src/analytics/siyuan-data.ts` — 数据获取不变
- `src/components/WikiCardsSection.vue` — 触发方式不变

### 变更规模估算

- 新增 composable：~150 行
- 重写 Dialog 组件：~250 行
- 其他文件适配：~50 行
- 总计：~450 行
