# 控制台日志开关设计

## 目标

在设置页增加“是否在控制台打印日志”的插件级开关，默认关闭。

## 约束

- 这是插件统一日志开关，不是单独的 AI 日志开关。
- `error` 级别日志始终打印，不受开关影响。
- 其他级别日志在开关关闭时不输出。
- 现有行为里最主要的日志出口是 AI 请求链路，第一阶段先接入该入口。

## 设计

### 配置

- 在 `PluginConfig` 增加 `enableConsoleLogging?: boolean`
- 在 `DEFAULT_CONFIG` 中默认值设为 `false`
- 在 `ensureConfigDefaults` 中把非布尔值归一化为 `false`

### UI

- 在设置页新增“调试”分组
- 增加一个开关项“在控制台打印日志”
- 说明文案明确写出 `error` 日志始终保留，其他级别受此开关控制

### 日志实现

- 新增统一 logger helper
- 对外暴露 `log`、`debug`、`info`、`warn`、`error`
- `error` 始终透传到 `console.error`
- 其他级别仅在 `enableConsoleLogging` 为 `true` 时输出

### 接入点

- `use-setting-panel-ai.ts` 创建 AI 服务时注入统一 logger
- `use-analytics.ts` 创建 AI 服务时注入统一 logger
- `ai-inbox.ts` 保持已有 logger 接口，继续走依赖注入

## 测试

- `src/types/config.test.ts` 覆盖默认值与归一化
- `src/components/SettingPanel.test.ts` 覆盖设置页渲染
- 新增 logger helper 测试，覆盖默认关闭、开启打印、`error` 始终打印
