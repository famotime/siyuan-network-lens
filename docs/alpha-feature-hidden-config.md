# Alpha 功能隐藏配置

更新时间：`2026-04-11`

## 目的

用于在发布版本中保留实现、但通过源码配置隐藏仍处于 alpha 阶段的功能。

隐藏后会同时影响这些入口：

- 主界面的顶部统计卡片
- 设置页里的对应统计卡片配置项
- 主界面的 LLM Wiki 维护入口
- 核心文档详情中的 LLM Wiki 维护入口
- 设置页里的 LLM Wiki 配置项
- 设置页里的 AI 服务商接入配置项

## 配置文件

编辑 [src/plugin/alpha-feature-config.ts](/D:/MyCodingProjects/siyuan-network-lens/src/plugin/alpha-feature-config.ts)：

```ts
export const ALPHA_FEATURE_HIDE_CONFIG = {
  hiddenSummaryCardKeys: [],
  hiddenSettingKeys: [],
}
```

修改后重新执行构建：

```bash
npm run build
```

## 配置项

`hiddenSummaryCardKeys`

- 用于隐藏指定统计卡片。
- 被隐藏的卡片不会出现在顶部卡片区。
- 被隐藏卡片对应的设置项也不会出现在设置页“统计卡片”分组里。
- 顶部卡片区本身不会消失，只会过滤掉指定卡片。

当前支持的卡片 key：

- `"read"`：已读/未读文档卡片
- `"todaySuggestions"`：今日建议卡片
- `"orphans"`：孤立文档卡片
- `"ranking"`：核心文档卡片
- `"documents"`：文档样本卡片
- `"largeDocuments"`：大文档卡片
- `"trends"`：趋势观察卡片
- `"references"`：活跃关系卡片
- `"communities"`：主题社区卡片
- `"propagation"`：传播节点卡片
- `"bridges"`：桥接节点卡片
- `"dormant"`：沉没文档卡片

`hiddenSettingKeys`

- 用于隐藏独立设置项和对应界面入口。

当前支持：

- `"ai-service"`：隐藏设置页里的 AI 服务商配置，包括 AI 今日建议开关、服务商、Base URL、API Key、Model、Embedding、导入导出和测试连接
- `"llm-wiki"`：隐藏设置页里的 LLM Wiki 开关与页面命名配置，同时隐藏主界面和核心文档详情中的 LLM Wiki 维护入口

## 联动规则

`todaySuggestions`

- 这是统计卡片 key，不是独立设置项。
- 如果把 `"todaySuggestions"` 放进 `hiddenSummaryCardKeys`，顶部“今日建议卡片”会消失，设置页里的对应卡片项也不会显示。
- 这不会自动隐藏 AI 服务商配置；如需一起隐藏，请再加入 `"ai-service"`。

`llm-wiki`

- 这是独立隐藏项，不依赖任何卡片 key。
- 如果把 `"llm-wiki"` 放进 `hiddenSettingKeys`，用户将看不到：
  - 设置页里的 `启用 LLM Wiki`
  - `页面后缀`
  - `索引页标题`
  - `日志页标题`
  - 文档样本详情下方的 `维护 LLM Wiki`
  - 核心文档详情里的 `维护 LLM Wiki`

`ai-service`

- 这是独立隐藏项，不会因为卡片隐藏而自动生效。
- 如果把 `"ai-service"` 放进 `hiddenSettingKeys`，用户将看不到 AI 接入服务商配置和测试连接入口。

## 示例

只隐藏“今日建议卡片”：

```ts
export const ALPHA_FEATURE_HIDE_CONFIG = {
  hiddenSummaryCardKeys: ['todaySuggestions'],
  hiddenSettingKeys: [],
}
```

隐藏“趋势观察卡片”和“今日建议卡片”，并额外隐藏 AI 服务商配置与 LLM Wiki：

```ts
export const ALPHA_FEATURE_HIDE_CONFIG = {
  hiddenSummaryCardKeys: ['trends', 'todaySuggestions'],
  hiddenSettingKeys: ['ai-service', 'llm-wiki'],
}
```

## 使用建议

- 发布版需要隐藏 alpha 功能时，直接修改这个文件后重新构建。
- 灰度结束后，把对应 key 从数组中移除即可恢复显示。
- 新增统计卡片或新的独立隐藏项时，优先同步更新 [src/plugin/alpha-feature-config.ts](/D:/MyCodingProjects/siyuan-network-lens/src/plugin/alpha-feature-config.ts) 和本说明文档。
