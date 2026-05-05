export type UiLocale = 'en_US' | 'zh_CN'

type UiTextMap = {
  en_US: string
  zh_CN: string
}

type UiInterpolationParams = Record<string, string | number>

const UI_TEXT = {
  app: {
    analyzing: {
      en_US: 'Analyzing...',
      zh_CN: '分析中...',
    },
    refreshAnalysis: {
      en_US: 'Refresh analysis',
      zh_CN: '刷新分析',
    },
    resetOrder: {
      en_US: 'Reset order',
      zh_CN: '重置顺序',
    },
    loading: {
      contextEyebrow: {
        en_US: 'Context loading',
        zh_CN: '上下文加载中',
      },
      contextTitle: {
        en_US: 'Preparing topic, tag, and reference overview',
        zh_CN: '正在准备主题、标签与引用概览',
      },
      contextDescription: {
        en_US: 'On first open, the plugin reads blocks, refs, and available topics and tags.',
        zh_CN: '首次打开时，插件会读取 blocks、refs，以及可用主题和标签。',
      },
    },
    filter: {
      timeWindow: {
        en_US: 'Time window',
        zh_CN: '时间窗口',
      },
      notebook: {
        en_US: 'Notebook',
        zh_CN: '笔记本',
      },
      noNotebooks: {
        en_US: 'No notebooks',
        zh_CN: '无笔记本',
      },
      allNotebooks: {
        en_US: 'All notebooks',
        zh_CN: '所有笔记本',
      },
      tags: {
        en_US: 'Tags',
        zh_CN: '标签',
      },
      allTags: {
        en_US: 'All tags',
        zh_CN: '全部标签',
      },
      noTags: {
        en_US: 'No tags',
        zh_CN: '无标签',
      },
      tagUnit: {
        en_US: 'tags',
        zh_CN: '个标签',
      },
      topics: {
        en_US: 'Topics',
        zh_CN: '主题',
      },
      keyword: {
        en_US: 'Keyword',
        zh_CN: '关键词',
      },
      keywordPlaceholder: {
        en_US: 'Filter by title, path, or tags',
        zh_CN: '按标题、路径或标签筛选',
      },
    },
    wiki: {
      hide: {
        en_US: 'Hide LLM Wiki',
        zh_CN: '收起 LLM Wiki',
      },
      maintain: {
        en_US: 'Maintain LLM Wiki',
        zh_CN: '维护 LLM Wiki',
      },
    },
  },
  shared: {
    clear: {
      en_US: 'Clear',
      zh_CN: '清空',
    },
    show: {
      en_US: 'Show',
      zh_CN: '显示',
    },
    hide: {
      en_US: 'Hide',
      zh_CN: '隐藏',
    },
    allTopics: {
      en_US: 'All topics',
      zh_CN: '全部主题',
    },
    noTopicDocsConfigured: {
      en_US: 'No topic docs configured',
      zh_CN: '暂无主题文档配置',
    },
    themesUnit: {
      en_US: 'themes',
      zh_CN: '个主题',
    },
    selectedThemesCount: {
      en_US: '{count} {unit} selected',
      zh_CN: '已选 {count} {unit}',
    },
    noOptionsAvailable: {
      en_US: 'No options available',
      zh_CN: '暂无可选项',
    },
    topicDoc: {
      en_US: 'Topic doc',
      zh_CN: '主题文档',
    },
    dormantThreshold: {
      en_US: 'Dormant threshold',
      zh_CN: '沉没阈值',
    },
    days30: {
      en_US: '30 days',
      zh_CN: '30 天',
    },
    days90: {
      en_US: '90 days',
      zh_CN: '90 天',
    },
    days180: {
      en_US: '180 days',
      zh_CN: '180 天',
    },
    noDocsUnderCard: {
      en_US: 'No docs to show under this card.',
      zh_CN: '当前卡片下暂无文档。',
    },
    suggestions: {
      en_US: 'Suggestions',
      zh_CN: '建议',
    },
    switchToUnreadDocs: {
      en_US: 'Switch to unread docs',
      zh_CN: '切换为未读文档',
    },
    switchToReadDocs: {
      en_US: 'Switch to read docs',
      zh_CN: '切换为已读文档',
    },
    switchToTextSizeMode: {
      en_US: 'Switch to text size mode',
      zh_CN: '切换为按文字统计',
    },
    switchToAssetSizeMode: {
      en_US: 'Switch to asset size mode',
      zh_CN: '切换为按资源统计',
    },
  },
  settings: {
    analysisScope: {
      title: {
        en_US: 'Analysis scope',
        zh_CN: '分析范围',
      },
      description: {
        en_US: 'Exclude paths from analysis. Matching docs are skipped when their paths and naming rules match.',
        zh_CN: '排除不参与分析的路径。文档路径与命名规则同时命中时会被跳过。',
      },
      excludedPaths: {
        en_US: 'Excluded paths',
        zh_CN: '排除路径',
      },
      excludedPathsPlaceholder: {
        en_US: 'Separate multiple paths with |. Full notebook paths are supported, for example /Knowledge/Exclude|/Archive/Temp',
        zh_CN: '多个路径用 | 分隔，支持完整笔记本路径，例如 /知识库笔记本/排除|/归档/临时',
      },
      namePrefixes: {
        en_US: 'Name prefixes',
        zh_CN: '名称前缀',
      },
      namePrefixesPlaceholder: {
        en_US: 'Separate multiple prefixes with |. Leave blank to exclude everything under the matched paths',
        zh_CN: '多个前缀用 | 分隔。留空则排除命中路径下的全部文档',
      },
      nameSuffixes: {
        en_US: 'Name suffixes',
        zh_CN: '名称后缀',
      },
      nameSuffixesPlaceholder: {
        en_US: 'Separate multiple suffixes with |. Leave blank to exclude everything under the matched paths',
        zh_CN: '多个后缀用 | 分隔。留空则排除命中路径下的全部文档',
      },
    },
    topicDocs: {
      title: {
        en_US: 'Topic docs',
        zh_CN: '主题文档',
      },
      description: {
        en_US: 'Point to topic page directories to build topic filters and link suggestions for orphan docs.',
        zh_CN: '指定主题页目录，用于构建主题筛选与孤立文档补链建议。',
      },
      pathLabel: {
        en_US: 'Topic doc paths',
        zh_CN: '主题文档路径',
      },
      pathPlaceholder: {
        en_US: 'Separate multiple paths with |. Full notebook paths are supported, for example /Knowledge/Topics|/Archive/Topics',
        zh_CN: '多个路径用 | 分隔，支持完整笔记本路径，例如 /知识库笔记本/主题|/归档/主题',
      },
      namePrefixes: {
        en_US: 'Name prefixes',
        zh_CN: '名称前缀',
      },
      namePrefixesPlaceholder: {
        en_US: 'Optional, for example Topic-',
        zh_CN: '可选，例如 主题-',
      },
      nameSuffixes: {
        en_US: 'Name suffixes',
        zh_CN: '名称后缀',
      },
      nameSuffixesPlaceholder: {
        en_US: 'Optional, for example -Index',
        zh_CN: '可选，例如 -索引',
      },
    },
    readRules: {
      title: {
        en_US: 'Read rules',
        zh_CN: '已读规则',
      },
      description: {
        en_US: 'Mark docs as read when any path, tag, title prefix, or title suffix rule matches.',
        zh_CN: '命中任一路径、标签、标题前缀或标题后缀规则时，将文档视为已读。',
      },
      readPaths: {
        en_US: 'Read paths',
        zh_CN: '已读路径',
      },
      readPathsPlaceholder: {
        en_US: 'Separate multiple paths with |. Full notebook paths are supported, for example /Knowledge/Read|/Archive/Topics',
        zh_CN: '多个路径用 | 分隔，支持完整笔记本路径，例如 /知识库笔记本/已读|/归档/主题',
      },
      readTags: {
        en_US: 'Read tags',
        zh_CN: '已读标签',
      },
      noneSelected: {
        en_US: 'None selected',
        zh_CN: '未选择',
      },
      noTagsAvailable: {
        en_US: 'No tags available',
        zh_CN: '暂无标签',
      },
      tagUnit: {
        en_US: 'tags',
        zh_CN: '个标签',
      },
      titlePrefixes: {
        en_US: 'Title prefixes',
        zh_CN: '标题前缀',
      },
      titlePrefixesPlaceholder: {
        en_US: 'Separate multiple prefixes with |, for example Read-|Star-',
        zh_CN: '多个前缀用 | 分隔，例如 已读-|星标-',
      },
      titleSuffixes: {
        en_US: 'Title suffixes',
        zh_CN: '标题后缀',
      },
      titleSuffixesPlaceholder: {
        en_US: 'Separate multiple suffixes with |, for example -Read|-FiveStar',
        zh_CN: '多个后缀用 | 分隔，例如 -已读|-五星',
      },
    },
    summaryCards: {
      title: {
        en_US: 'Summary cards',
        zh_CN: '统计卡片',
      },
      description: {
        en_US: 'Control the top summary cards and the linked detail views.',
        zh_CN: '控制顶部统计卡片及其联动详情视图。',
      },
      topSummaryCards: {
        en_US: 'Top summary cards',
        zh_CN: '顶部统计卡片',
      },
      topSummaryCardsDescription: {
        en_US: 'Show all metric cards and allow click-through detail views',
        zh_CN: '显示全部指标卡片，并支持点击联动详情',
      },
    },
    ai: {
      title: {
        en_US: 'AI settings',
        zh_CN: 'AI 设置',
      },
      description: {
        en_US: 'Configure an OpenAI-compatible service for today suggestions and AI link suggestions for orphan docs.',
        zh_CN: '配置兼容 OpenAI 的服务，用于今日建议和孤立文档 AI 补链建议。',
      },
      wikiDescription: {
        en_US: 'Configure LLM Wiki switches and page naming rules.',
        zh_CN: '配置 LLM Wiki 开关与页面命名规则。',
      },
      enableTodaySuggestions: {
        en_US: 'Enable today suggestions',
        zh_CN: '启用今日建议',
      },
      enableTodaySuggestionsDescription: {
        en_US: 'Generate one prioritized cleanup list from the current analysis',
        zh_CN: '基于当前分析生成一份优先级整理清单',
      },
      enableWiki: {
        en_US: 'Enable LLM Wiki',
        zh_CN: '启用 LLM Wiki',
      },
      enableWikiDescription: {
        en_US: 'Generate topic wiki previews from current filters and write them back safely.',
        zh_CN: '基于当前筛选生成主题 Wiki 预览，并安全写回。',
      },
      pageSuffix: {
        en_US: 'Page suffix',
        zh_CN: '页面后缀',
      },
      indexPageTitle: {
        en_US: 'Index page title',
        zh_CN: '索引页标题',
      },
      logPageTitle: {
        en_US: 'Log page title',
        zh_CN: '日志页标题',
      },
      containerName: {
        en_US: 'Wiki container name',
        zh_CN: 'Wiki 容器名称',
      },
      provider: {
        en_US: 'AI provider',
        zh_CN: 'AI 提供方',
      },
      importSettings: {
        en_US: 'Import settings',
        zh_CN: '导入设置',
      },
      exportSettings: {
        en_US: 'Export settings',
        zh_CN: '导出设置',
      },
      baseUrl: {
        en_US: 'Base URL',
        zh_CN: 'Base URL',
      },
      apiKey: {
        en_US: 'API Key',
        zh_CN: 'API Key',
      },
      model: {
        en_US: 'Model',
        zh_CN: '模型',
      },
      timeout: {
        en_US: 'Timeout',
        zh_CN: '超时',
      },
      maxTokens: {
        en_US: 'Max tokens',
        zh_CN: '最大 Token',
      },
      temperature: {
        en_US: 'Temperature',
        zh_CN: 'Temperature',
      },
      maxContextMessages: {
        en_US: 'Max context messages',
        zh_CN: '最大上下文消息数',
      },
      contextCapacity: {
        en_US: 'Context capacity',
        zh_CN: '上下文容量',
      },
      contextCapacityCompact: {
        en_US: 'Compact',
        zh_CN: '紧凑',
      },
      contextCapacityBalanced: {
        en_US: 'Balanced',
        zh_CN: '平衡',
      },
      contextCapacityFull: {
        en_US: 'Full',
        zh_CN: '完整',
      },
      testing: {
        en_US: 'Testing...',
        zh_CN: '测试中...',
      },
      testConnection: {
        en_US: 'Test connection',
        zh_CN: '测试连接',
      },
      lastLoadFailed: {
        en_US: 'Last load failed: {error}',
        zh_CN: '最近一次加载失败：{error}',
      },
      timeoutHint: {
        en_US: 'If you hit a timeout or `context deadline exceeded`, switch to `Compact` first.',
        zh_CN: '如果遇到超时或 `context deadline exceeded`，优先切到“紧凑”。',
      },
    },
    debug: {
      title: {
        en_US: 'Debug',
        zh_CN: '调试',
      },
      description: {
        en_US: 'Control standard console logs used during development and troubleshooting.',
        zh_CN: '控制开发和排障时使用的标准控制台日志。',
      },
      printLogs: {
        en_US: 'Print logs in console',
        zh_CN: '在控制台打印日志',
      },
      printLogsDescription: {
        en_US: 'Error logs are always kept; other levels follow this toggle',
        zh_CN: '错误日志始终保留，其他级别受此开关控制',
      },
      showDocumentIndex: {
        en_US: 'View document index',
        zh_CN: '查看文档索引',
      },
      showDocumentIndexDescription: {
        en_US: 'Show document index buttons in document sample details for generating and viewing per-document indexes.',
        zh_CN: '在文档样本详情中显示文档索引按钮，用于生成和查看单个文档的索引。',
      },
    },
    propagation: {
      title: {
        en_US: 'Propagation and paths',
        zh_CN: '传播与路径',
      },
      description: {
        en_US: 'Propagation node details include a path view for relationship spread.',
        zh_CN: '传播节点详情包含关系传播路径视图。',
      },
    },
  },
  summaryDetail: {
    collapseDetails: {
      en_US: 'Collapse details',
      zh_CN: '收起详情',
    },
    expandDetails: {
      en_US: 'Expand details',
      zh_CN: '展开详情',
    },
    historyLabel: {
      en_US: 'History:',
      zh_CN: '历史：',
    },
    analyzing: {
      en_US: 'Analyzing...',
      zh_CN: '分析中...',
    },
    reanalyze: {
      en_US: 'Reanalyze',
      zh_CN: '重新分析',
    },
    todaySuggestions: {
      en_US: 'Today suggestions',
      zh_CN: '今日建议',
    },
    aiEmpty: {
      enableAi: {
        en_US: 'Enable AI in Settings to generate today suggestions from the current filters here.',
        zh_CN: '请先在设置中启用 AI，以基于当前筛选生成今日建议。',
      },
      incompleteConfig: {
        en_US: 'OpenAI-compatible settings are incomplete. Add Base URL, API Key, and Model in Settings.',
        zh_CN: '兼容 OpenAI 的设置不完整，请在设置中补充 Base URL、API Key 和 Model。',
      },
      openTodaySuggestions: {
        en_US: 'Open Today suggestions to start analyzing the current filters.',
        zh_CN: '打开“今日建议”开始分析当前筛选。',
      },
    },
    aiSection: {
      suggestedTargets: {
        en_US: 'Suggested targets',
        zh_CN: '建议目标',
      },
      recommendedAction: {
        en_US: 'Recommended action',
        zh_CN: '建议动作',
      },
      whyFirst: {
        en_US: 'Why this first',
        zh_CN: '优先原因',
      },
    },
    counts: {
      suggestions: {
        en_US: '{count} suggestions',
        zh_CN: '{count} 条建议',
      },
      docs: {
        en_US: '{count} docs',
        zh_CN: '{count} 篇文档',
      },
    },
    empty: {
      noDocs: {
        en_US: 'No docs to show under this card.',
        zh_CN: '当前卡片下暂无文档可展示。',
      },
      noPropagationNodes: {
        en_US: 'No propagation nodes to show under this card.',
        zh_CN: '当前卡片下暂无传播节点可展示。',
      },
      noExplainablePath: {
        en_US: 'No explainable path found under the current filters.',
        zh_CN: '当前筛选下没有可解释的路径。',
      },
    },
    documentIndex: {
      generate: {
        en_US: 'Generate index',
        zh_CN: '生成文档索引',
      },
      generating: {
        en_US: 'Generating...',
        zh_CN: '生成中...',
      },
      view: {
        en_US: 'View index',
        zh_CN: '查看文档索引',
      },
      viewTitle: {
        en_US: 'Document Index: {title}',
        zh_CN: '文档索引：{title}',
      },
      viewPositioning: {
        en_US: 'Positioning',
        zh_CN: '定位',
      },
      viewPropositions: {
        en_US: 'Propositions',
        zh_CN: '原文命题',
      },
      viewKeywords: {
        en_US: 'Keywords',
        zh_CN: '关键词',
      },
      viewPrimarySourceBlocks: {
        en_US: 'Core Evidence Blocks',
        zh_CN: '核心证据块',
      },
      viewSecondarySourceBlocks: {
        en_US: 'Supplementary Evidence Blocks',
        zh_CN: '补充证据块',
      },
      viewUpdatedAt: {
        en_US: 'Index updated at',
        zh_CN: '索引更新时间',
      },
      viewWarning: {
        en_US: 'This is a temporary document generated for viewing the document index only. It is not part of your notes. Please delete it immediately after viewing to avoid confusion with your actual notes.',
        zh_CN: '这是一篇用于查看文档索引的临时文档，不属于笔记内容。查看完毕后建议立即删除，以免与笔记文档混淆。',
      },
      batchGenerate: {
        en_US: 'Batch generate indexes',
        zh_CN: '批量生成索引',
      },
      batchGenerating: {
        en_US: 'Generating {done}/{total}...',
        zh_CN: '生成中 {done}/{total}...',
      },
      batchDelete: {
        en_US: 'Batch delete indexes',
        zh_CN: '批量删除索引',
      },
    },
    propagation: {
      title: {
        en_US: 'Propagation paths',
        zh_CN: '传播路径',
      },
      description: {
        en_US: 'Limit path depth and scope to see how docs connect across topics.',
        zh_CN: '限制路径深度和范围，查看文档如何跨主题连接。',
      },
      scopeLabel: {
        en_US: 'Scope',
        zh_CN: '范围',
      },
      scopeFocused: {
        en_US: 'Core + bridge',
        zh_CN: '核心 + 桥接',
      },
      scopeAll: {
        en_US: 'All filtered docs',
        zh_CN: '全部筛选文档',
      },
      scopeCommunity: {
        en_US: 'Current cluster',
        zh_CN: '当前社区',
      },
      maxDepth: {
        en_US: 'Max depth',
        zh_CN: '最大深度',
      },
      fromLabel: {
        en_US: 'From',
        zh_CN: '起点',
      },
      toLabel: {
        en_US: 'To',
        zh_CN: '终点',
      },
    },
    themeSuggestionTooltip: {
      en_US: '{title} · Matched {count} times',
      zh_CN: '{title} · 命中 {count} 次',
    },
    trends: {
      currentWindow: {
        en_US: 'Current window',
        zh_CN: '当前窗口',
      },
      previousWindow: {
        en_US: 'Previous window',
        zh_CN: '上一窗口',
      },
      newLinks: {
        en_US: 'New links',
        zh_CN: '新增连接',
      },
      brokenLinks: {
        en_US: 'Broken links',
        zh_CN: '断开连接',
      },
      documentHeat: {
        en_US: 'Document Heat',
        zh_CN: '文档升温',
      },
      risingDocs: {
        en_US: 'Rising docs',
        zh_CN: '上升文档',
      },
      noClearlyRisingDocs: {
        en_US: 'No clearly rising docs.',
        zh_CN: '暂无明显上升文档。',
      },
      documentCooling: {
        en_US: 'Document Cooling',
        zh_CN: '文档降温',
      },
      coolingDocs: {
        en_US: 'Cooling docs',
        zh_CN: '降温文档',
      },
      noClearlyCoolingDocs: {
        en_US: 'No clearly cooling docs.',
        zh_CN: '暂无明显降温文档。',
      },
      communityLift: {
        en_US: 'Community Lift',
        zh_CN: '社区升温',
      },
      risingTopics: {
        en_US: 'Rising topics',
        zh_CN: '上升主题',
      },
      noClearlyRisingTopics: {
        en_US: 'No clearly rising topics.',
        zh_CN: '暂无明显上升主题。',
      },
      communityIdle: {
        en_US: 'Community Idle',
        zh_CN: '社区沉寂',
      },
      lowActivityTopics: {
        en_US: 'Low-activity topics',
        zh_CN: '低活跃主题',
      },
      lowActivity: {
        en_US: 'Low activity',
        zh_CN: '低活跃',
      },
      noClearlyLowActivityTopics: {
        en_US: 'No clearly low-activity topics.',
        zh_CN: '暂无明显低活跃主题。',
      },
      brokenPaths: {
        en_US: 'Broken Paths',
        zh_CN: '断裂路径',
      },
      brokenPathDescription: {
        en_US: 'Open the path source doc to trace the relationship before and after the break.',
        zh_CN: '打开路径源文档，追踪断开前后的关系变化。',
      },
      noClearlyBrokenLinks: {
        en_US: 'No clearly broken links.',
        zh_CN: '暂无明显断开连接。',
      },
      currentPrevious: {
        en_US: 'Current {current} · Previous {previous}',
        zh_CN: '当前 {current} · 上一窗口 {previous}',
      },
      referenceCount: {
        en_US: '{count} refs',
        zh_CN: '{count} 条引用',
      },
    },
    labels: {
      repairLinks: {
        en_US: 'Repair links',
        zh_CN: '补链修复',
      },
      repairLinksWithTopics: {
        en_US: '{text}, suggested topic docs below (click to add):',
        zh_CN: '{text}，下方是建议主题文档（点击可添加）：',
      },
      buildTopicPage: {
        en_US: 'Build topic page',
        zh_CN: '创建主题页',
      },
      bridgeRisk: {
        en_US: 'Bridge risk',
        zh_CN: '桥接风险',
      },
      documentCleanup: {
        en_US: 'Document cleanup',
        zh_CN: '文档整理',
      },
    },
    historyTooltip: {
      generated: {
        en_US: 'Generated: {value}',
        zh_CN: '生成于：{value}',
      },
      window: {
        en_US: 'Window: {value}',
        zh_CN: '窗口：{value}',
      },
      count: {
        en_US: 'Count: {value}',
        zh_CN: '数量：{value}',
      },
      notebook: {
        en_US: 'Notebook: {value}',
        zh_CN: '笔记本：{value}',
      },
      tags: {
        en_US: 'Tags: {value}',
        zh_CN: '标签：{value}',
      },
      topics: {
        en_US: 'Topics: {value}',
        zh_CN: '主题：{value}',
      },
      keyword: {
        en_US: 'Keyword: {value}',
        zh_CN: '关键词：{value}',
      },
      unknownTime: {
        en_US: 'Unknown time',
        zh_CN: '未知时间',
      },
      all: {
        en_US: 'All',
        zh_CN: '全部',
      },
      none: {
        en_US: 'None',
        zh_CN: '无',
      },
      noValidTopicDocPathConfigured: {
        en_US: 'No valid topic doc path is configured, so the LLM Wiki target cannot be resolved',
        zh_CN: '未配置有效的主题文档路径，无法确定 LLM Wiki 写入位置',
      },
      markdownOverviewHeading: {
        en_US: '### Overview',
        zh_CN: '### 页面概览',
      },
      markdownUpdatedAt: {
        en_US: '- Updated at: {value}',
        zh_CN: '- 最近维护时间：{value}',
      },
      markdownTopicWikiPages: {
        en_US: '- Topic wiki pages: {count}',
        zh_CN: '- 主题 wiki 页数：{count}',
      },
      markdownUnclassifiedSources: {
        en_US: '- Unclassified sources: {count}',
        zh_CN: '- 未归类来源数：{count}',
      },
      markdownMatchedTopicsThisRun: {
        en_US: '- Matched topics this run: {count}',
        zh_CN: '- 本轮命中主题数：{count}',
      },
      markdownWikiPagesHeading: {
        en_US: '### Wiki pages',
        zh_CN: '### Wiki 页面清单',
      },
      markdownWikiPageRow: {
        en_US: '- {pageLink} | Paired topic page: {themeLink} | Summary: {summary} | Source docs: {count} | Updated at: {updatedAt}',
        zh_CN: '- {pageLink} | 配对主题页：{themeLink} | 摘要：{summary} | 源文档数：{count} | 最近更新时间：{updatedAt}',
      },
      markdownNoTopicWikiPagesYet: {
        en_US: '- No topic wiki pages yet',
        zh_CN: '- 暂无主题 wiki 页面',
      },
      markdownUnclassifiedSourcesHeading: {
        en_US: '### Unclassified sources',
        zh_CN: '### 未归类来源',
      },
      markdownNone: {
        en_US: '- None',
        zh_CN: '- 无',
      },
      overviewHeading: {
        en_US: 'Overview',
        zh_CN: '页面概览',
      },
      logTouchedPagesHeading: {
        en_US: '### Touched pages this run',
        zh_CN: '### 本次触达页面',
      },
      logMatchedSourceDocs: {
        en_US: '- Matched source docs: {count}',
        zh_CN: '- 命中源文档数：{count}',
      },
      logMatchedTopics: {
        en_US: '- Matched topics: {count}',
        zh_CN: '- 命中主题数：{count}',
      },
      logCreatedPages: {
        en_US: '- Created pages: {count}',
        zh_CN: '- 新建页面数：{count}',
      },
      logUpdatedPages: {
        en_US: '- Updated pages: {count}',
        zh_CN: '- 更新页面数：{count}',
      },
      logUnchangedPages: {
        en_US: '- Unchanged pages: {count}',
        zh_CN: '- 无变化页面数：{count}',
      },
      logConflictPages: {
        en_US: '- Conflict pages: {count}',
        zh_CN: '- 冲突页面数：{count}',
      },
      logTouchedPageRow: {
        en_US: '- {result}: {page}',
        zh_CN: '- {result}：{page}',
      },
      resultCreated: {
        en_US: 'created',
        zh_CN: '新建',
      },
      resultUpdated: {
        en_US: 'updated',
        zh_CN: '更新',
      },
      resultSkipped: {
        en_US: 'skipped',
        zh_CN: '无变化',
      },
      resultConflict: {
        en_US: 'conflict',
        zh_CN: '冲突',
      },
    },
  },
  aiInbox: {
    title: {
      en_US: 'AI cleanup inbox',
      zh_CN: 'AI 整理收件箱',
    },
    description: {
      en_US: 'What should you handle first today?',
      zh_CN: '今天应优先处理什么？',
    },
    testing: {
      en_US: 'Testing...',
      zh_CN: '测试中...',
    },
    testConnection: {
      en_US: 'Test connection',
      zh_CN: '测试连接',
    },
    generating: {
      en_US: 'Generating...',
      zh_CN: '生成中...',
    },
    todaySuggestions: {
      en_US: 'Today suggestions',
      zh_CN: '今日建议',
    },
    collapse: {
      en_US: 'Collapse',
      zh_CN: '收起',
    },
    expand: {
      en_US: 'Expand',
      zh_CN: '展开',
    },
    enableHint: {
      en_US: 'Enable the AI cleanup inbox in Settings to generate today\'s prioritized tasks from the current filters.',
      zh_CN: '请先在设置中启用 AI 整理收件箱，以基于当前筛选生成今日优先任务。',
    },
    incompleteConfig: {
      en_US: 'OpenAI-compatible settings are incomplete. Add Base URL, API Key, and Model in Settings.',
      zh_CN: '兼容 OpenAI 的设置不完整，请在设置中补充 Base URL、API Key 和 Model。',
    },
    empty: {
      en_US: 'Click Today suggestions to turn current card and detail signals into one prioritized list.',
      zh_CN: '点击“今日建议”，把当前卡片和详情信号整理成一份优先级列表。',
    },
    taskCount: {
      en_US: '{count} tasks',
      zh_CN: '{count} 个任务',
    },
    openDoc: {
      en_US: 'Open doc',
      zh_CN: '打开文档',
    },
    recommendedAction: {
      en_US: 'Recommended action',
      zh_CN: '推荐动作',
    },
    whyFirst: {
      en_US: 'Why this first:',
      zh_CN: '推荐理由',
    },
    suggestedTargets: {
      en_US: 'Suggested targets',
      zh_CN: '推荐目标',
    },
    evidence: {
      en_US: 'Evidence',
      zh_CN: '证据',
    },
    expectedChanges: {
      en_US: 'Expected changes',
      zh_CN: '处理后变化',
    },
    labels: {
      repairLinks: {
        en_US: 'Repair links',
        zh_CN: '补链修复',
      },
      buildTopicPage: {
        en_US: 'Build topic page',
        zh_CN: '创建主题页',
      },
      bridgeRisk: {
        en_US: 'Bridge risk',
        zh_CN: '桥接风险',
      },
      documentCleanup: {
        en_US: 'Document cleanup',
        zh_CN: '文档整理',
      },
    },
  },
    orphanDetail: {
    sortLabel: {
      en_US: 'Orphan sort',
      zh_CN: '孤立排序',
    },
    sortUpdated: {
      en_US: 'By updated time',
      zh_CN: '按更新时间',
    },
    sortCreated: {
      en_US: 'By created time',
      zh_CN: '按创建时间',
    },
    sortTitle: {
      en_US: 'By title',
      zh_CN: '按标题',
    },
    themeTooltip: {
      en_US: '{title} · Matched {count} times',
      zh_CN: '{title} · 命中 {count} 次',
    },
    regenerateAiSuggestions: {
      en_US: 'Regenerate AI suggestions',
      zh_CN: '重新生成 AI 建议',
    },
    aiSuggestions: {
      en_US: 'AI suggestions',
      zh_CN: 'AI 建议',
    },
    aiConfigHint: {
      en_US: 'Complete AI settings in Settings first.',
      zh_CN: '请先完成 AI 设置。',
    },
    linkSuggestions: {
      en_US: 'Link suggestions',
      zh_CN: '链接建议',
    },
    tagSuggestions: {
      en_US: 'Tag suggestions',
      zh_CN: '标签建议',
    },
    itemCount: {
      en_US: '{count} items',
      zh_CN: '{count} 项',
    },
    empty: {
      en_US: 'No docs to show under this card.',
      zh_CN: '当前卡片下暂无文档。',
    },
    repairLinksWithTopics: {
      en_US: '{text}, suggested topic docs below (click to add):',
      zh_CN: '{text}，建议链接以下主题文档（点击添加）：',
    },
    existingTag: {
      en_US: 'Existing tag',
      zh_CN: '当前标签',
    },
      newTag: {
        en_US: 'New tag',
        zh_CN: '新标签',
      },
      confidenceHigh: {
        en_US: 'HIGH',
        zh_CN: '高',
      },
      confidenceMedium: {
        en_US: 'MEDIUM',
        zh_CN: '中',
      },
      confidenceLow: {
        en_US: 'LOW',
        zh_CN: '低',
      },
    },
  rankingPanel: {
    title: {
      en_US: 'Core docs ranking',
      zh_CN: '核心文档排行',
    },
    description: {
      en_US: 'Ranked by doc-level inbound refs, source doc count, and recent activity.',
      zh_CN: '按文档级入链、来源文档数和近期活跃度排序。',
    },
    docsCount: {
      en_US: '{count} docs',
      zh_CN: '{count} 篇文档',
    },
    lastRefreshed: {
      en_US: 'Last refreshed {value}',
      zh_CN: '最近刷新 {value}',
    },
    collapseDetails: {
      en_US: 'Collapse details',
      zh_CN: '收起详情',
    },
    expandDetails: {
      en_US: 'Expand details',
      zh_CN: '展开详情',
    },
    collapse: {
      en_US: 'Collapse',
      zh_CN: '收起',
    },
    expand: {
      en_US: 'Expand',
      zh_CN: '展开',
    },
    inboundRefs: {
      en_US: '{count} inbound refs',
      zh_CN: '{count} 条入链',
    },
    sourceDocs: {
      en_US: '{count} source docs',
      zh_CN: '{count} 个来源文档',
    },
    tags: {
      en_US: '{count} tags',
      zh_CN: '{count} 个标签',
    },
    outboundRefs: {
      en_US: '{count} outbound refs',
      zh_CN: '{count} 条出链',
    },
    connectionSummary: {
      en_US: '{inbound} inbound ({sources} sources)  {outbound} outbound  {children} child docs',
      zh_CN: '{inbound}条入链（{sources}个来源） {outbound}条出链 {children}个子文档',
    },
    created: {
      en_US: 'Created',
      zh_CN: '创建',
    },
    updated: {
      en_US: 'Updated',
      zh_CN: '更新',
    },
    hideRelated: {
      en_US: 'Hide related refs/links',
      zh_CN: '收起关联引用/链接',
    },
    viewRelated: {
      en_US: 'View related refs/links',
      zh_CN: '查看关联引用/链接',
    },
    outbound: {
      en_US: 'Outbound',
      zh_CN: '出链',
    },
    inbound: {
      en_US: 'Inbound',
      zh_CN: '入链',
    },
    childDocsDeduped: {
      en_US: 'Child docs (deduped)',
      zh_CN: '子文档（去重）',
    },
    syncing: {
      en_US: 'Syncing...',
      zh_CN: '同步中...',
    },
    sync: {
      en_US: 'Sync',
      zh_CN: '同步',
    },
    linking: {
      en_US: 'Linking...',
      zh_CN: '链接中...',
    },
    link: {
      en_US: 'Link',
      zh_CN: '补链',
    },
    noOutbound: {
      en_US: 'No outbound links.',
      zh_CN: '暂无出链。',
    },
    noInbound: {
      en_US: 'No inbound links.',
      zh_CN: '暂无入链。',
    },
    noChildLinks: {
      en_US: 'No child doc links available to add.',
      zh_CN: '没有可补充的子文档链接。',
    },
    hideWiki: {
      en_US: 'Hide LLM Wiki',
      zh_CN: '收起 LLM Wiki',
    },
    maintainWiki: {
      en_US: 'Maintain LLM Wiki',
      zh_CN: '维护 LLM Wiki',
    },
    empty: {
      en_US: 'No doc-level reference relationships matched the current filters.',
      zh_CN: '当前筛选下没有命中文档级引用关系。',
    },
  },
  wikiMaintain: {
    title: {
      en_US: 'LLM Wiki maintenance',
      zh_CN: 'LLM Wiki 维护',
    },
    description: {
      en_US: 'Generate topic wiki previews from the current scope, then write them back to topic pages, the index page, and the maintenance log after confirmation.',
      zh_CN: '基于当前分析范围生成主题 Wiki 预览，确认后再写回主题页、索引页和维护日志。',
    },
    generating: {
      en_US: 'Generating...',
      zh_CN: '生成中...',
    },
    generatePreview: {
      en_US: 'Generate preview',
      zh_CN: '生成预览',
    },
    applying: {
      en_US: 'Applying...',
      zh_CN: '应用中...',
    },
    applyChanges: {
      en_US: 'Apply changes',
      zh_CN: '应用变更',
    },
    allowOverwriteConflictPages: {
      en_US: 'Allow overwrite for conflict pages',
      zh_CN: '允许覆盖冲突页面',
    },
    enableWikiFirst: {
      en_US: 'Enable LLM Wiki first',
      zh_CN: '请先启用 LLM Wiki',
    },
    enableSuggestionsAndAi: {
      en_US: 'Enable today suggestions and complete AI settings first',
      zh_CN: '请先启用今日建议并完成 AI 配置',
    },
    matchedSourceDocs: {
      en_US: 'Matched source docs',
      zh_CN: '命中源文档',
    },
    matchedTopics: {
      en_US: 'Matched topics',
      zh_CN: '命中主题',
    },
    excludedWikiPages: {
      en_US: 'Excluded wiki pages',
      zh_CN: '排除的 Wiki 页面',
    },
    unclassifiedSources: {
      en_US: 'Unclassified sources',
      zh_CN: '未归类来源',
    },
    pairedTopicPage: {
      en_US: 'Paired topic page',
      zh_CN: '配对主题页',
    },
    status: {
      en_US: 'Status',
      zh_CN: '状态',
    },
    sourceDocs: {
      en_US: 'Source docs',
      zh_CN: '源文档数',
    },
    affectedSections: {
      en_US: 'Affected sections',
      zh_CN: '影响分区',
    },
    template: {
      en_US: 'Template',
      zh_CN: '模板',
    },
    confidence: {
      en_US: 'Confidence',
      zh_CN: '置信度',
    },
    sectionOrder: {
      en_US: 'Section order',
      zh_CN: '分区顺序',
    },
    diagnosisReason: {
      en_US: 'Diagnosis reason',
      zh_CN: '诊断理由',
    },
    diagnosisEvidence: {
      en_US: 'Diagnosis evidence',
      zh_CN: '诊断证据',
    },
    noChanges: {
      en_US: 'No changes',
      zh_CN: '无变化',
    },
    manualNotes: {
      en_US: 'Manual notes',
      zh_CN: '人工备注',
    },
    manualNotesReserved: {
      en_US: '> Reserved for manual notes. Later automated maintenance will not overwrite this section.',
      zh_CN: '> 这里保留给人工补充，后续自动维护不会覆盖本区内容。',
    },
    existing: {
      en_US: 'Existing',
      zh_CN: '已存在',
    },
    createdOnFirstWrite: {
      en_US: 'Created on first write',
      zh_CN: '首次写入时创建',
    },
    oldSummary: {
      en_US: 'Old summary:',
      zh_CN: '旧摘要：',
    },
    newSummary: {
      en_US: 'New summary:',
      zh_CN: '新摘要：',
    },
    noPreviousContent: {
      en_US: 'No previous content',
      zh_CN: '暂无旧内容',
    },
    noNewContent: {
      en_US: 'No new content',
      zh_CN: '暂无新内容',
    },
    openDetail: {
      en_US: 'View details',
      zh_CN: '打开详情',
    },
    pairedTopicPageLine: {
      en_US: '- Paired topic page: {value}',
      zh_CN: '- 配对主题页：{value}',
    },
    generatedAtLine: {
      en_US: '- Generated at: {value}',
      zh_CN: '- 生成时间：{value}',
    },
    sourceDocsLine: {
      en_US: '- Source docs: {value}',
      zh_CN: '- 源文档数：{value}',
    },
    modelLine: {
      en_US: '- Model: {value}',
      zh_CN: '- 模型：{value}',
    },
    noContentYet: {
      en_US: '- No content yet',
      zh_CN: '- 暂无内容',
    },
    noMaintainablePages: {
      en_US: 'No topic wiki pages can be maintained in the current scope',
      zh_CN: '当前范围内没有可维护的主题 Wiki 页面',
    },
    openIndexPage: {
      en_US: 'Open index page',
      zh_CN: '打开索引页',
    },
    openLogPage: {
      en_US: 'Open log page',
      zh_CN: '打开日志页',
    },
    openLatestUpdatedPage: {
      en_US: 'Open latest updated page',
      zh_CN: '打开最近更新页',
    },
    statusCreate: {
      en_US: 'Create',
      zh_CN: '新建',
    },
    statusUpdate: {
      en_US: 'Update',
      zh_CN: '更新',
    },
    statusUnchanged: {
      en_US: 'Unchanged',
      zh_CN: '无变化',
    },
    statusConflict: {
      en_US: 'Conflict',
      zh_CN: '冲突',
    },
    templateTechTopic: {
      en_US: 'Tech topic',
      zh_CN: '技术主题',
    },
    templateProductHowto: {
      en_US: 'Product how-to',
      zh_CN: '产品用法',
    },
    templateSocialTopic: {
      en_US: 'Social topic',
      zh_CN: '社会议题',
    },
    templateMediaList: {
      en_US: 'Media list',
      zh_CN: '媒体清单',
    },
    confidenceHigh: {
      en_US: 'HIGH',
      zh_CN: '高',
    },
    confidenceMedium: {
      en_US: 'MEDIUM',
      zh_CN: '中',
    },
    confidenceLow: {
      en_US: 'LOW',
      zh_CN: '低',
    },
    applyRunSummary: {
      en_US: 'This apply run: created {created} / updated {updated} / unchanged {skipped} / conflict {conflict}',
      zh_CN: '本次写回：新建 {created} / 更新 {updated} / 无变化 {skipped} / 冲突 {conflict}',
    },
  },
  aiConfig: {
    tooltipBaseUrl: {
      en_US: 'OpenAI-compatible services usually require a /v1 suffix, for example https://api.siliconflow.cn/v1',
      zh_CN: '兼容 OpenAI 的服务通常需要 /v1 后缀，例如 https://api.siliconflow.cn/v1',
    },
    tooltipTimeout: {
      en_US: 'Request timeout in seconds',
      zh_CN: '请求超时秒数',
    },
    tooltipMaxTokens: {
      en_US: 'The max_tokens value sent to the API, used to limit generated output length',
      zh_CN: '发送给 API 的 max_tokens，用于限制生成长度',
    },
    tooltipTemperature: {
      en_US: 'The temperature value sent to the API, used to control randomness',
      zh_CN: '发送给 API 的 temperature，用于控制随机性',
    },
    tooltipMaxContextMessages: {
      en_US: 'Maximum context messages sent to the API',
      zh_CN: '发送给 API 的最大上下文消息数',
    },
    tooltipSiliconFlowChatModel: {
      en_US: 'Automatically load SiliconFlow chat models when the select opens',
      zh_CN: '打开下拉时自动加载 SiliconFlow 聊天模型清单',
    },
    enterApiKeyFirst: {
      en_US: 'Enter API Key first',
      zh_CN: '请先填写 API Key',
    },
    loadingChatModels: {
      en_US: 'Loading chat models...',
      zh_CN: '正在加载聊天模型...',
    },
    loadFailedRetry: {
      en_US: 'Load failed, click to retry',
      zh_CN: '加载失败，点击重试',
    },
    selectChatModel: {
      en_US: 'Select chat model',
      zh_CN: '请选择聊天模型',
    },
    clickToLoadChatModels: {
      en_US: 'Click to load chat models',
      zh_CN: '点击加载聊天模型',
    },
    siliconFlow: {
      en_US: 'SiliconFlow',
      zh_CN: '硅基流动',
    },
    custom: {
      en_US: 'Custom',
      zh_CN: '自定义',
    },
    selectModelPlaceholder: {
      en_US: 'Select from the model list, for example deepseek-ai/DeepSeek-V3',
      zh_CN: '从模型列表中选择，例如 deepseek-ai/DeepSeek-V3',
    },
    enterModelNameManually: {
      en_US: 'Enter model name manually',
      zh_CN: '手动输入模型名',
    },
    settingsExported: {
      en_US: 'AI settings exported',
      zh_CN: 'AI 设置已导出',
    },
    failedExport: {
      en_US: 'Failed to export AI settings',
      zh_CN: '导出 AI 设置失败',
    },
    settingsImported: {
      en_US: 'AI settings imported',
      zh_CN: 'AI 设置已导入',
    },
    failedImport: {
      en_US: 'Failed to import AI settings',
      zh_CN: '导入 AI 设置失败',
    },
    invalidJson: {
      en_US: 'AI settings file is not valid JSON',
      zh_CN: 'AI 设置文件不是合法 JSON',
    },
    invalidFormat: {
      en_US: 'Invalid AI settings file format',
      zh_CN: 'AI 设置文件格式无效',
    },
    actionTextMentionsTopicDoc: {
      en_US: 'Action text mentions topic doc {name}',
      zh_CN: '动作文案提及主题文档 {name}',
    },
  },
  analytics: {
    wiki: {
      enableTodaySuggestionsInSettings: {
        en_US: 'Enable today suggestions in Settings first',
        zh_CN: '请先在设置中启用 AI 今日建议',
      },
      incompleteAiSettings: {
        en_US: 'AI settings are incomplete. Add Base URL, API Key, and Model.',
        zh_CN: 'AI 接入配置不完整，请补充 Base URL、API Key 和 Model。',
      },
      diagnoseThemeTemplatePrompt: {
        en_US: 'Diagnose the best wiki template for the current theme wiki page. Theme: {theme}.',
        zh_CN: '请诊断当前主题 wiki 最适合的模板类型。主题：{theme}。',
      },
      diagnoseThemeTemplateSchemaPrompt: {
        en_US: 'Return JSON only with templateType, confidence, reason, enabledModules, suppressedModules, and evidenceSummary.',
        zh_CN: '请只返回 JSON，并包含 templateType、confidence、reason、enabledModules、suppressedModules、evidenceSummary。',
      },
      planThemePagePrompt: {
        en_US: 'Generate a wiki page plan from the diagnosis for the current theme. Theme: {theme}.',
        zh_CN: '请基于模板诊断结果规划主题 wiki 页面结构。主题：{theme}。',
      },
      planThemePageSchemaPrompt: {
        en_US: 'Return JSON only with templateType, confidence, coreSections, optionalSections, sectionOrder, sectionGoals, and sectionFormats.',
        zh_CN: '请只返回 JSON，并包含 templateType、confidence、coreSections、optionalSections、sectionOrder、sectionGoals、sectionFormats。',
      },
      generateThemeSectionPrompt: {
        en_US: 'Generate exactly one wiki section draft for the current theme. Theme: {theme}. Section type: {sectionType}.',
        zh_CN: '请只生成一个 wiki 章节草稿。主题：{theme}。章节类型：{sectionType}。',
      },
      generateThemeSectionSchemaPrompt: {
        en_US: 'Return JSON only with sectionType, title, format, blocks, and sourceRefs. Each block must include text and sourceRefs. Populate sourceRefs with documentId values (not blockId) from the provided source documents that support each block.',
        zh_CN: '请只返回 JSON，并包含 sectionType、title、format、blocks、sourceRefs。每个 block 必须包含 text 和 sourceRefs。请使用所提供的源文档 documentId（非 blockId）填充每个 block 的 sourceRefs。',
      },
      generateStructuredContentPrompt: {
        en_US: 'Generate structured content for the topic wiki page. Topic: {theme}.',
        zh_CN: '请为主题 wiki 页面生成结构化内容。主题：{theme}。',
      },
      emphasizeSectionsPrompt: {
        en_US: 'Emphasize the topic overview, key documents, structure observations, relationship evidence, and cleanup actions.',
        zh_CN: '请突出主题概览、关键文档、结构观察、关系证据和整理动作。',
      },
      conservativeFallbackPrompt: {
        en_US: 'If evidence is weak in any section, respond conservatively with "No clear ..." instead of inventing content.',
        zh_CN: '如果某部分证据不足，可以保守输出“暂无明显...”而不是编造。',
      },
      aiRequestFailed: {
        en_US: 'AI request failed ({status})',
        zh_CN: 'AI 请求失败（{status}）',
      },
      aiReturnedUnparseableJson: {
        en_US: 'AI returned JSON that could not be parsed',
        zh_CN: 'AI 接口返回了无法解析的 JSON',
      },
      aiReturnedInvalidJson: {
        en_US: 'AI did not return valid JSON',
        zh_CN: 'AI 返回内容不是合法 JSON',
      },
      aiReturnedUnreadableContent: {
        en_US: 'AI did not return readable content',
        zh_CN: 'AI 接口未返回可读内容',
      },
      noClearTemplateReasonYet: {
        en_US: 'No clear template reason yet',
        zh_CN: '暂无足够证据支持明确模板判断',
      },
      noClearTemplateEvidenceYet: {
        en_US: 'No clear template evidence yet',
        zh_CN: '当前缺少足够的来源文档与分析信号',
      },
      pagePlanFallbackGoal: {
        en_US: 'Fallback: a conservative page plan was used because the model did not return a complete valid page plan.',
        zh_CN: '回退：因模型未返回完整有效的页面规划，已使用保守回退规划。',
      },
      noClearTopicOverviewYet: {
        en_US: 'No clear topic overview yet',
        zh_CN: '暂无明显主题概览',
      },
      noKeyDocumentSuggestionsYet: {
        en_US: 'No key document suggestions yet',
        zh_CN: '暂无关键文档建议',
      },
      noClearStructureObservationsYet: {
        en_US: 'No clear structure observations yet',
        zh_CN: '暂无明显结构观察',
      },
      noClearRelationshipEvidenceYet: {
        en_US: 'No clear relationship evidence yet',
        zh_CN: '暂无明显关系证据',
      },
      noClearCleanupActionsYet: {
        en_US: 'No clear cleanup actions yet',
        zh_CN: '暂无明确整理动作',
      },
      noClearFaqYet: {
        en_US: 'No clear FAQ items yet',
        zh_CN: '暂无明确常见问题',
      },
      noClearTroubleshootingYet: {
        en_US: 'No clear troubleshooting guidance yet',
        zh_CN: '暂无明确排障建议',
      },
      noClearMisunderstandingsYet: {
        en_US: 'No clear misunderstandings to clarify yet',
        zh_CN: '暂无明确误区澄清',
      },
      noClearOpenQuestionsYet: {
        en_US: 'No clear open questions yet',
        zh_CN: '暂无明确待解问题',
      },
      conflictReasonManagedAreaMismatch: {
        en_US: 'The current AI managed area does not match the fingerprint from the last plugin write. Manual edits or external updates may exist.',
        zh_CN: '当前 AI 管理区内容与上次插件写入指纹不一致，可能存在人工修改或外部更新。',
      },
      scopeSourceCurrentDocSample: {
        en_US: '- Scope source: current doc sample',
        zh_CN: '- 范围来源：当前文档样本',
      },
      timeWindowLine: {
        en_US: '- Time window: {value}',
        zh_CN: '- 时间窗口：{value}',
      },
      notebookLine: {
        en_US: '- Notebook: {value}',
        zh_CN: '- 笔记本：{value}',
      },
      tagsLine: {
        en_US: '- Tags: {value}',
        zh_CN: '- 标签：{value}',
      },
      topicsLine: {
        en_US: '- Topics: {value}',
        zh_CN: '- 主题：{value}',
      },
      keywordLine: {
        en_US: '- Keyword: {value}',
        zh_CN: '- 关键词：{value}',
      },
      allNotebooks: {
        en_US: 'All notebooks',
        zh_CN: '所有笔记本',
      },
      allTags: {
        en_US: 'All tags',
        zh_CN: '全部标签',
      },
      allTopics: {
        en_US: 'All topics',
        zh_CN: '全部主题',
      },
      none: {
        en_US: 'None',
        zh_CN: '无',
      },
      noValidTopicDocPathConfigured: {
        en_US: 'No valid topic doc path is configured, so the LLM Wiki target cannot be resolved',
        zh_CN: '未配置有效的主题文档路径，无法确定 LLM Wiki 写入位置',
      },
      markdownOverviewHeading: {
        en_US: '### Overview',
        zh_CN: '### 页面概览',
      },
      markdownUpdatedAt: {
        en_US: '- Updated at: {value}',
        zh_CN: '- 最近维护时间：{value}',
      },
      markdownTopicWikiPages: {
        en_US: '- Topic wiki pages: {count}',
        zh_CN: '- 主题 wiki 页数：{count}',
      },
      markdownUnclassifiedSources: {
        en_US: '- Unclassified sources: {count}',
        zh_CN: '- 未归类来源数：{count}',
      },
      markdownMatchedTopicsThisRun: {
        en_US: '- Matched topics this run: {count}',
        zh_CN: '- 本轮命中主题数：{count}',
      },
      markdownWikiPagesHeading: {
        en_US: '### Wiki pages',
        zh_CN: '### Wiki 页面清单',
      },
      markdownWikiPageRow: {
        en_US: '- {pageLink} | Paired topic page: {themeLink} | Summary: {summary} | Source docs: {count} | Updated at: {updatedAt}',
        zh_CN: '- {pageLink} | 配对主题页：{themeLink} | 摘要：{summary} | 源文档数：{count} | 最近更新时间：{updatedAt}',
      },
      markdownNoTopicWikiPagesYet: {
        en_US: '- No topic wiki pages yet',
        zh_CN: '- 暂无主题 wiki 页面',
      },
      markdownUnclassifiedSourcesHeading: {
        en_US: '### Unclassified sources',
        zh_CN: '### 未归类来源',
      },
      markdownNone: {
        en_US: '- None',
        zh_CN: '- 无',
      },
      overviewHeading: {
        en_US: 'Overview',
        zh_CN: '页面概览',
      },
      logTouchedPagesHeading: {
        en_US: '### Touched pages this run',
        zh_CN: '### 本次触达页面',
      },
      logMatchedSourceDocs: {
        en_US: '- Matched source docs: {count}',
        zh_CN: '- 命中源文档数：{count}',
      },
      logMatchedTopics: {
        en_US: '- Matched topics: {count}',
        zh_CN: '- 命中主题数：{count}',
      },
      logCreatedPages: {
        en_US: '- Created pages: {count}',
        zh_CN: '- 新建页面数：{count}',
      },
      logUpdatedPages: {
        en_US: '- Updated pages: {count}',
        zh_CN: '- 更新页面数：{count}',
      },
      logUnchangedPages: {
        en_US: '- Unchanged pages: {count}',
        zh_CN: '- 无变化页面数：{count}',
      },
      logConflictPages: {
        en_US: '- Conflict pages: {count}',
        zh_CN: '- 冲突页面数：{count}',
      },
      logTouchedPageRow: {
        en_US: '- {result}: {page}',
        zh_CN: '- {result}：{page}',
      },
      resultCreated: {
        en_US: 'created',
        zh_CN: '新建',
      },
      resultUpdated: {
        en_US: 'updated',
        zh_CN: '更新',
      },
      resultSkipped: {
        en_US: 'skipped',
        zh_CN: '无变化',
      },
      resultConflict: {
        en_US: 'conflict',
        zh_CN: '冲突',
      },
    },
    summaryCards: {
      docSample: {
        en_US: 'Doc sample',
        zh_CN: '文档样本',
      },
      docsMatchedByCurrentFilters: {
        en_US: 'Docs matched by current filters',
        zh_CN: '当前筛选命中的文档',
      },
      readDocs: {
        en_US: 'Read docs',
        zh_CN: '已读文档',
      },
      unreadDocs: {
        en_US: 'Unread docs',
        zh_CN: '未读文档',
      },
      docsMatchedByReadRules: {
        en_US: 'Docs matched by read rules',
        zh_CN: '命中已读规则的文档',
      },
      docsNotMatchedByReadRules: {
        en_US: 'Docs not matched by read rules',
        zh_CN: '未命中已读规则的文档',
      },
      todaySuggestions: {
        en_US: 'Today suggestions',
        zh_CN: '今日建议',
      },
      aiRankedSuggestionsForToday: {
        en_US: 'AI-ranked suggestions for today',
        zh_CN: 'AI 排序的今日建议',
      },
      largeDocsAssets: {
        en_US: 'Large docs · assets',
        zh_CN: '大文档 · 资源',
      },
      largeDocsText: {
        en_US: 'Large docs · text',
        zh_CN: '大文档 · 正文',
      },
      docsLargerThan3Mb: {
        en_US: 'Docs larger than 3 MB in total size',
        zh_CN: '总大小超过 3 MB 的文档',
      },
      docsLargerThan10000Words: {
        en_US: 'Docs with text count above 10,000',
        zh_CN: '正文统计超过 10,000 的文档',
      },
      activeLinks: {
        en_US: 'Active links',
        zh_CN: '活跃连接',
      },
      docLevelReferencesInCurrentWindow: {
        en_US: 'Doc-level references in the current window',
        zh_CN: '当前窗口内的文档级引用',
      },
      coreDocs: {
        en_US: 'Core docs',
        zh_CN: '核心文档',
      },
      mostReferencedDocsInCurrentWindow: {
        en_US: 'Most referenced docs in the current window',
        zh_CN: '当前窗口内被引用最多的文档',
      },
      trendWatch: {
        en_US: 'Trend watch',
        zh_CN: '趋势观察',
      },
      docsWithActivityChanges: {
        en_US: 'Docs with activity changes in the current window',
        zh_CN: '当前窗口内活动发生变化的文档',
      },
      topicClusters: {
        en_US: 'Topic clusters',
        zh_CN: '主题社区',
      },
      topicClustersSplitByBridgeNodes: {
        en_US: 'Topic clusters split by bridge nodes',
        zh_CN: '按桥接节点拆分出的主题社区',
      },
      orphanDocs: {
        en_US: 'Orphan docs',
        zh_CN: '孤立文档',
      },
      noValidDocLevelLinksInCurrentWindow: {
        en_US: 'No valid doc-level links in the current window',
        zh_CN: '当前窗口内没有有效文档级连接',
      },
      dormantDocs: {
        en_US: 'Dormant docs',
        zh_CN: '沉没文档',
      },
      noValidLinksForMoreThanDays: {
        en_US: 'No valid links for more than {days} days',
        zh_CN: '超过 {days} 天没有有效连接',
      },
      bridgeDocs: {
        en_US: 'Bridge docs',
        zh_CN: '桥接文档',
      },
      docsWhoseRemovalWeakensConnectivity: {
        en_US: 'Docs whose removal weakens community connectivity',
        zh_CN: '移除后会削弱社区连通性的文档',
      },
      propagationNodes: {
        en_US: 'Propagation nodes',
        zh_CN: '传播节点',
      },
      highImpactRelayNodes: {
        en_US: 'High-impact relay nodes on key paths',
        zh_CN: '关键路径上的高影响中继节点',
      },
    },
    summaryCardConfig: {
      readUnreadCard: {
        en_US: 'Read / unread card',
        zh_CN: '已读 / 未读卡片',
      },
      readUnreadCardDescription: {
        en_US: 'Show read status counts and switch between read and unread views',
        zh_CN: '显示已读状态统计，并支持在已读和未读视图间切换',
      },
      todaySuggestionsCard: {
        en_US: 'Today suggestions card',
        zh_CN: '今日建议卡片',
      },
      todaySuggestionsCardDescription: {
        en_US: 'Show AI-ranked cleanup suggestions and open the linked detail panel',
        zh_CN: '显示 AI 排序后的整理建议，并打开联动详情面板',
      },
      orphanDocsCard: {
        en_US: 'Orphan docs card',
        zh_CN: '孤立文档卡片',
      },
      orphanDocsCardDescription: {
        en_US: 'Show docs without valid doc-level links in the current window',
        zh_CN: '显示当前窗口内没有有效文档级连接的文档',
      },
      coreDocsCard: {
        en_US: 'Core docs card',
        zh_CN: '核心文档卡片',
      },
      coreDocsCardDescription: {
        en_US: 'Show core doc counts and open linked details',
        zh_CN: '显示核心文档数量并打开联动详情',
      },
      docSampleCard: {
        en_US: 'Doc sample card',
        zh_CN: '文档样本卡片',
      },
      docSampleCardDescription: {
        en_US: 'Show the number of docs matched by the current filters',
        zh_CN: '显示当前筛选命中的文档数量',
      },
      largeDocsCard: {
        en_US: 'Large docs card',
        zh_CN: '大文档卡片',
      },
      largeDocsCardDescription: {
        en_US: 'Show large docs by text or asset thresholds',
        zh_CN: '按文本或资源体积阈值显示大文档',
      },
      trendWatchCard: {
        en_US: 'Trend watch card',
        zh_CN: '趋势观察卡片',
      },
      trendWatchCardDescription: {
        en_US: 'Show trend changes and open linked details',
        zh_CN: '显示趋势变化并打开联动详情',
      },
      activeLinksCard: {
        en_US: 'Active links card',
        zh_CN: '活跃连接卡片',
      },
      activeLinksCardDescription: {
        en_US: 'Show doc-level reference counts in the current window',
        zh_CN: '显示当前窗口内的文档级引用数量',
      },
      topicClustersCard: {
        en_US: 'Topic clusters card',
        zh_CN: '主题社区卡片',
      },
      topicClustersCardDescription: {
        en_US: 'Show cluster scale and open linked details',
        zh_CN: '显示社区规模并打开联动详情',
      },
      propagationNodesCard: {
        en_US: 'Propagation nodes card',
        zh_CN: '传播节点卡片',
      },
      propagationNodesCardDescription: {
        en_US: 'Show high-propagation-value node summaries',
        zh_CN: '显示高传播价值节点摘要',
      },
      bridgeDocsCard: {
        en_US: 'Bridge docs card',
        zh_CN: '桥接文档卡片',
      },
      bridgeDocsCardDescription: {
        en_US: 'Show bridge docs whose removal weakens cluster connectivity',
        zh_CN: '显示移除后会削弱社区连通性的桥接文档',
      },
      dormantDocsCard: {
        en_US: 'Dormant docs card',
        zh_CN: '沉没文档卡片',
      },
      dormantDocsCardDescription: {
        en_US: 'Show docs past the inactivity threshold without valid links',
        zh_CN: '显示超过不活跃阈值且没有有效连接的文档',
      },
    },
    summaryDetailSource: {
      createdDate: {
        en_US: 'Created {date}',
        zh_CN: '创建于 {date}',
      },
      needsReview: {
        en_US: 'Needs review',
        zh_CN: '待处理',
      },
      docsMatchedByCurrentFiltersSentence: {
        en_US: 'Docs matched by the current filters.',
        zh_CN: '当前筛选命中的文档。',
      },
      updatedDatePath: {
        en_US: '{path} · Updated {date}',
        zh_CN: '{path} · 更新于 {date}',
      },
      docsMatchedByReadRulesSentence: {
        en_US: 'Docs matched by read paths, tags, or title rules.',
        zh_CN: '命中已读路径、标签或标题规则的文档。',
      },
      docsNotMatchedByReadRulesSentence: {
        en_US: 'Docs not matched by read paths, tags, or title rules.',
        zh_CN: '未命中已读路径、标签或标题规则的文档。',
      },
      suggestionsRankedByPriority: {
        en_US: 'Suggestions ranked by priority.',
        zh_CN: '按优先级排序的建议。',
      },
      largeDocsAssetsSentence: {
        en_US: 'Docs larger than 3 MB in total size.',
        zh_CN: '总大小超过 3 MB 的文档。',
      },
      largeDocsTextSentence: {
        en_US: 'Docs with text count above 10,000.',
        zh_CN: '正文统计超过 10,000 的文档。',
      },
      docsParticipatingInLinks: {
        en_US: 'Docs participating in doc-level links in the current window.',
        zh_CN: '当前窗口内参与文档级连接的文档。',
      },
      inboundOutbound: {
        en_US: 'Inbound {inbound} / Outbound {outbound}',
        zh_CN: '入链 {inbound} / 出链 {outbound}',
      },
      refsCount: {
        en_US: '{count} refs',
        zh_CN: '{count} 条引用',
      },
      mostReferencedDocsSentence: {
        en_US: 'Most connected docs.',
        zh_CN: '被关联最多的文档。',
      },
      activityChangesBetweenWindows: {
        en_US: 'Activity changes between the current and previous windows.',
        zh_CN: '当前窗口与上一窗口之间的活跃变化。',
      },
      docsGroupedIntoClusters: {
        en_US: 'Docs grouped into topic clusters.',
        zh_CN: '按主题聚成社区的文档。',
      },
      clusterTagsAndSize: {
        en_US: 'Cluster tags: {tags} · Cluster size {size}',
        zh_CN: '社区标签：{tags} · 社区规模 {size}',
      },
      none: {
        en_US: 'None',
        zh_CN: '无',
      },
      missingTopicPage: {
        en_US: 'Missing topic page',
        zh_CN: '缺少主题页',
      },
      docsWithNoValidLinksSentence: {
        en_US: 'Docs with no valid doc-level links in the current window.',
        zh_CN: '当前窗口内没有有效文档级连接的文档。',
      },
      promoteHubReason: {
        en_US: 'Referenced by {docs} docs, {refs} refs in total',
        zh_CN: '被 {docs} 篇文档引用，共 {refs} 条引用',
      },
      repairOrphanReason: {
        en_US: 'No doc-level links in the current window',
        zh_CN: '当前窗口内没有有效的文档级连接',
      },
      repairOrphanHistoricalReason: {
        en_US: 'No doc-level links in the current window, but {count} historical reference traces still exist',
        zh_CN: '当前窗口内没有有效的文档级连接，但仍保留 {count} 条历史连接证据',
      },
      updatedCreated: {
        en_US: 'Updated {updated} · Created {created}',
        zh_CN: '更新于 {updated} · 创建于 {created}',
      },
      dormantDescription: {
        en_US: 'No valid links for more than {days} days, with possible historical in/out links.',
        zh_CN: '超过 {days} 天没有有效连接，但可能存在历史入链或出链。',
      },
      archiveDormantReason: {
        en_US: 'No valid links for {days} days. Good candidate for archiving or index repair',
        zh_CN: '{days} 天没有有效连接，适合归档或补一个索引入口',
      },
      inactiveDaysLastLinked: {
        en_US: '{days} inactive days · Last linked {date}',
        zh_CN: '{days} 天未活跃 · 最近连接于 {date}',
      },
      historicalLinks: {
        en_US: '{count} historical links',
        zh_CN: '{count} 条历史连接',
      },
      bridgeDescription: {
        en_US: 'Key docs whose removal weakens community connectivity.',
        zh_CN: '移除后会削弱社区连通性的关键文档。',
      },
      maintainBridgeReason: {
        en_US: 'Connects {count} relationships. Removing it would break cluster connectivity',
        zh_CN: '当前连接 {count} 条关系，移除后会破坏社区连通性',
      },
      degree: {
        en_US: 'Degree {value}',
        zh_CN: '连接度 {value}',
      },
      propagationDescription: {
        en_US: 'Docs that frequently appear on key shortest paths.',
        zh_CN: '频繁出现在关键最短路径上的文档。',
      },
      coversFocusDocsCommunitySpan: {
        en_US: 'Covers {focus} focus docs · Community span {span}',
        zh_CN: '覆盖 {focus} 个焦点文档 · 跨越 {span} 个社区',
      },
      scorePts: {
        en_US: '{score} pts',
        zh_CN: '{score} 分',
      },
      bridgeHint: {
        en_US: ', also acting as a community bridge',
        zh_CN: '，同时承担社区桥接角色',
      },
      propagationOptimization: {
        en_US: 'Propagation optimization',
        zh_CN: '传播优化',
      },
      propagationOptimizationText: {
        en_US: 'Appears on {paths} key shortest paths, covering {focus} focus docs{bridgeHint}. Add path notes and upstream/downstream navigation.',
        zh_CN: '出现在 {paths} 条关键最短路径上，覆盖 {focus} 个焦点文档{bridgeHint}。建议补充路径说明与上下游导航。',
      },
      cleanEmbeddedAssets: {
        en_US: 'Clean embedded assets',
        zh_CN: '清理嵌入资源',
      },
      cleanEmbeddedAssetsText: {
        en_US: '{assetCount} embedded assets use {assetBytes}. Total size is {totalBytes}. Remove assets that are no longer needed.',
        zh_CN: '{assetCount} 个嵌入资源占用 {assetBytes}，总大小为 {totalBytes}。可清理不再需要的资源。',
      },
      tagsPrefix: {
        en_US: 'Tags: {value}',
        zh_CN: '标签：{value}',
      },
      prefixesPrefix: {
        en_US: 'Prefixes: {value}',
        zh_CN: '前缀：{value}',
      },
      suffixesPrefix: {
        en_US: 'Suffixes: {value}',
        zh_CN: '后缀：{value}',
      },
      pathsPrefix: {
        en_US: 'Paths: {value}',
        zh_CN: '路径：{value}',
      },
      tagMatch: {
        en_US: 'Tag match',
        zh_CN: '标签命中',
      },
      titleMatch: {
        en_US: 'Title match',
        zh_CN: '标题命中',
      },
      pathMatch: {
        en_US: 'Path match',
        zh_CN: '路径命中',
      },
      allTime: {
        en_US: 'All time',
        zh_CN: '全部时间',
      },
      last3Days: {
        en_US: 'Last 3 days',
        zh_CN: '最近 3 天',
      },
      last7Days: {
        en_US: 'Last 7 days',
        zh_CN: '最近 7 天',
      },
      last30Days: {
        en_US: 'Last 30 days',
        zh_CN: '最近 30 天',
      },
      last60Days: {
        en_US: 'Last 60 days',
        zh_CN: '最近 60 天',
      },
      last90Days: {
        en_US: 'Last 90 days',
        zh_CN: '最近 90 天',
      },
      failedToDetectNewTopicLinkBlock: {
        en_US: 'Failed to detect the new topic link block',
        zh_CN: '未能识别新建的主题链接块',
      },
      failedToWriteDocTags: {
        en_US: 'Failed to write doc tags. Please try again later.',
        zh_CN: '写入文档标签失败，请稍后重试',
      },
      failedToDetectNewAiLinkBlock: {
        en_US: 'Failed to detect the new AI link block',
        zh_CN: '未能识别新建的 AI 链接块',
      },
      generatedAiLinkSuggestionsForTitle: {
        en_US: 'Generated AI link suggestions for {title}',
        zh_CN: '已生成 {title} 的 AI 补链建议',
      },
    },
    docSummary: {
      aiRequestFailed: {
        en_US: 'AI summary request failed (HTTP {status})',
        zh_CN: 'AI 摘要请求失败（HTTP {status}）',
      },
      aiRequired: {
        en_US: 'AI is required for document indexing. Please configure Base URL, API Key, and Model in settings.',
        zh_CN: '文档索引需要 AI 支持，请在设置中配置 Base URL、API Key 和 Model。',
      },
      invalidAiResponse: {
        en_US: 'AI returned an invalid response. Please try again.',
        zh_CN: 'AI 返回了无效响应，请重试。',
      },
    },
    controller: {
      trendCompareLastDays: {
        en_US: 'Compare the last {days} days with the previous window',
        zh_CN: '对比最近 {days} 天与上一窗口',
      },
      failedToReadSiYuanData: {
        en_US: 'Failed to read SiYuan data',
        zh_CN: '读取思源数据失败',
      },
      unknownTime: {
        en_US: 'Unknown time',
        zh_CN: '未知时间',
      },
      enableWikiFirst: {
        en_US: 'Enable LLM Wiki in Settings first',
        zh_CN: '请先在设置中启用 LLM Wiki',
      },
      enableSuggestionsAndAi: {
        en_US: 'Enable today suggestions and complete AI settings first',
        zh_CN: '请先启用今日建议并完成 AI 配置',
      },
      analysisNotReady: {
        en_US: 'Analysis results are not ready yet. Refresh analysis first.',
        zh_CN: '分析结果尚未就绪，请先刷新分析。',
      },
      aiProxyNotInitialized: {
        en_US: 'AI proxy is not initialized',
        zh_CN: 'AI 代理未初始化',
      },
      wikiStorageNotInitialized: {
        en_US: 'LLM Wiki storage is not initialized',
        zh_CN: 'LLM Wiki 存储未初始化',
      },
      failedToGenerateWikiPreview: {
        en_US: 'Failed to generate LLM Wiki preview',
        zh_CN: '生成 LLM Wiki 预览失败',
      },
      noWikiPreviewAvailable: {
        en_US: 'No LLM Wiki preview is available yet',
        zh_CN: '当前还没有可用的 LLM Wiki 预览',
      },
      wikiWriteCapabilityNotInitialized: {
        en_US: 'LLM Wiki write capability is not initialized',
        zh_CN: 'LLM Wiki 写入能力未初始化',
      },
      failedToWriteWiki: {
        en_US: 'Failed to write LLM Wiki',
        zh_CN: '写入 LLM Wiki 失败',
      },
      aiConnectionTestFailed: {
        en_US: 'AI connection test failed',
        zh_CN: 'AI 连接测试失败',
      },
      failedToGenerateAiInbox: {
        en_US: 'Failed to generate AI inbox',
        zh_CN: '生成 AI 收件箱失败',
      },
      currentDocNotInOrphanList: {
        en_US: 'The current doc is not in the orphan doc list',
        zh_CN: '当前文档不在孤立文档列表中',
      },
      failedToSaveAiIndexRecord: {
        en_US: 'Failed to save AI index record',
        zh_CN: '保存 AI 索引记录失败',
      },
      analyzingDocumentSemantics: {
        en_US: 'Analyzing document structure...',
        zh_CN: '正在分析文档结构……',
      },
      failedToGenerateAiLinkSuggestions: {
        en_US: 'Failed to generate AI link suggestions',
        zh_CN: '生成 AI 补链建议失败',
      },
      relatedLinkSynced: {
        en_US: 'Related link synced',
        zh_CN: '关联链接已同步',
      },
      syncFailed: {
        en_US: 'Sync failed',
        zh_CN: '同步失败',
      },
      topicLinkSuggestionRemoved: {
        en_US: 'Topic link suggestion removed',
        zh_CN: '主题补链建议已移除',
      },
      failedToRemoveTopicLink: {
        en_US: 'Failed to remove topic link',
        zh_CN: '移除主题链接失败',
      },
      matchingTopicDocNotFound: {
        en_US: 'Matching topic doc not found',
        zh_CN: '未找到匹配的主题文档',
      },
      topicLinkInsertedRefreshAnalysis: {
        en_US: 'Topic link inserted. Refresh analysis to re-check orphan status.',
        zh_CN: '主题链接已插入。请刷新分析以重新检查孤立状态。',
      },
      failedToInsertTopicLink: {
        en_US: 'Failed to insert topic link',
        zh_CN: '插入主题链接失败',
      },
      aiLinkSuggestionRemoved: {
        en_US: 'AI link suggestion removed',
        zh_CN: 'AI 补链建议已移除',
      },
      failedToRemoveAiLink: {
        en_US: 'Failed to remove AI link',
        zh_CN: '移除 AI 链接失败',
      },
      aiSuggestedLinkInsertedRefreshAnalysis: {
        en_US: 'AI suggested link inserted. Refresh analysis to re-check orphan status.',
        zh_CN: 'AI 建议链接已插入。请刷新分析以重新检查孤立状态。',
      },
      failedToInsertAiSuggestedLink: {
        en_US: 'Failed to insert AI suggested link',
        zh_CN: '插入 AI 建议链接失败',
      },
      tagEmptyCannotWrite: {
        en_US: 'Tag is empty and cannot be written',
        zh_CN: '标签为空，无法写入',
      },
      matchingDocNotFoundCannotWriteTag: {
        en_US: 'Matching doc not found. Cannot write tag.',
        zh_CN: '未找到匹配文档，无法写入标签。',
      },
      noDocTagApiCannotWriteTag: {
        en_US: 'The current environment does not provide a doc tag API. Cannot write tag.',
        zh_CN: '当前环境未提供文档标签 API，无法写入标签。',
      },
      aiTagSuggestionRemoved: {
        en_US: 'AI tag suggestion removed',
        zh_CN: 'AI 标签建议已移除',
      },
      aiTagSuggestionWritten: {
        en_US: 'AI tag suggestion written',
        zh_CN: 'AI 标签建议已写入',
      },
      failedToWriteAiTag: {
        en_US: 'Failed to write AI tag',
        zh_CN: '写入 AI 标签失败',
      },
      documentNotFound: {
        en_US: 'Document not found',
        zh_CN: '文档未找到',
      },
      docIndexGenerated: {
        en_US: 'Document index generated',
        zh_CN: '文档索引已生成',
      },
      docIndexGenerateFailed: {
        en_US: 'Failed to generate document index',
        zh_CN: '生成文档索引失败',
      },
      docIndexNotFound: {
        en_US: 'Document index not found',
        zh_CN: '文档索引未找到',
      },
      docIndexCreateFailed: {
        en_US: 'Failed to create document index view',
        zh_CN: '创建文档索引查看文档失败',
      },
    },
    aiLink: {
      enableAiInSettingsFirst: {
        en_US: 'Enable AI in Settings first',
        zh_CN: '请先在设置中启用 AI',
      },
      incompleteSettings: {
        en_US: 'AI link suggestion settings are incomplete. Add Base URL, API Key, and Model.',
        zh_CN: 'AI 补链配置不完整，请补充 Base URL、API Key 和 Model。',
      },
      notEnoughCandidateTargets: {
        en_US: 'There are not enough candidate targets for AI link suggestions right now',
        zh_CN: '当前缺少足够清晰的 AI 补链候选目标',
      },
      aiIsAnalyzing: {
        en_US: 'AI is analyzing...',
        zh_CN: 'AI 正在分析……',
      },
      requestFailed: {
        en_US: 'AI link suggestion request failed ({status})',
        zh_CN: 'AI 补链请求失败（{status}）',
      },
      unreadableContent: {
        en_US: 'AI did not return readable link suggestion content',
        zh_CN: 'AI 未返回可读的补链内容',
      },
      invalidJson: {
        en_US: 'AI link suggestions did not return valid JSON',
        zh_CN: 'AI 补链结果未返回合法 JSON',
      },
      invalidSuggestions: {
        en_US: 'AI did not return valid link suggestions',
        zh_CN: 'AI 未返回有效的补链建议',
      },
      generatedForCurrentOrphan: {
        en_US: 'AI link suggestions generated for the current orphan doc.',
        zh_CN: '已为当前孤立文档生成 AI 补链建议。',
      },
      candidateThemeMatch: {
        en_US: 'Topic match hit {count} times',
        zh_CN: '主题匹配命中 {count} 次',
      },
      candidateTopicEntry: {
        en_US: 'Acts as a topic entry point',
        zh_CN: '可作为主题入口页',
      },
      candidateReferencedByDocs: {
        en_US: 'Referenced by {count} docs',
        zh_CN: '被 {count} 篇文档引用',
      },
      candidateInboundRefsCurrentWindow: {
        en_US: '{count} inbound refs in the current window',
        zh_CN: '当前窗口内有 {count} 条入链',
      },
    },
    aiInbox: {
      promptProduceUnifiedTaskList: {
        en_US: 'Based on the doc-link network analysis below, produce one unified task list for what should be handled first today.',
        zh_CN: '请基于下面的文档级引用网络分析结果，给出“今天优先处理什么”的统一待办列表。',
      },
      promptPreferHighScoringCandidates: {
        en_US: 'Return 5 to 8 items when possible, preferring high-scoring candidates from actionCandidates.',
        zh_CN: '优先输出 5 到 8 项，优先从 actionCandidates 中挑选高分候选。',
      },
      promptKeepStructureCompact: {
        en_US: 'Keep the structure compact: merge recommended actions and suggestions into action, and merge why-this-first plus expected gains into reason.',
        zh_CN: '输出结构要更紧凑：把推荐动作和建议合并到 action，把为什么先做和预估收益合并成推荐理由写到 reason。',
      },
      promptMakeActionSpecific: {
        en_US: 'Each item should make clear what to handle now, where to link it or what page to create, and why it should be done first.',
        zh_CN: '每项建议尽量写清：现在处理哪个对象、补到哪里/建什么页、推荐理由是什么。',
      },
      promptDoNotFabricateWeakEvidence: {
        en_US: 'Do not fabricate weak evidence. If no clear target exists, leave it empty honestly.',
        zh_CN: '如果证据不足，不要硬造；如果没有明确目标，就如实保留为空。',
      },
      aiReturnedUnreadableContent: {
        en_US: 'AI did not return readable content',
        zh_CN: 'AI 接口未返回可读内容',
      },
      connectionSuccessful: {
        en_US: 'Connection successful',
        zh_CN: '连接成功',
      },
      enableTodaySuggestionsInSettings: {
        en_US: 'Enable today suggestions in Settings first',
        zh_CN: '请先在设置中启用 AI 今日建议',
      },
      incompleteAiSettings: {
        en_US: 'AI settings are incomplete. Add Base URL, API Key, and Model.',
        zh_CN: 'AI 接入配置不完整，请补充 Base URL、API Key 和 Model',
      },
      aiReturnedUnparseableJson: {
        en_US: 'AI returned JSON that could not be parsed',
        zh_CN: 'AI 接口返回了无法解析的 JSON',
      },
      enterSiliconFlowBaseUrlAndApiKeyFirst: {
        en_US: 'Before loading the model list, enter SiliconFlow Base URL and API Key first',
        zh_CN: '加载模型列表前，请先填写 SiliconFlow 的 Base URL 和 API Key',
      },
      modelListRequestFailed: {
        en_US: 'Model list request failed ({status})',
        zh_CN: '模型列表请求失败（{status}）',
      },
      aiReturnedInvalidJson: {
        en_US: 'AI did not return valid JSON',
        zh_CN: 'AI 返回内容不是合法 JSON',
      },
      aiDidNotReturnValidCleanupTasks: {
        en_US: 'AI did not return valid cleanup tasks',
        zh_CN: 'AI 未返回有效的整理待办',
      },
      cleanupPrioritiesGenerated: {
        en_US: 'Cleanup priorities generated from the current reference network.',
        zh_CN: '已根据当前引用网络生成整理优先级。',
      },
      baseUrlLikelyNeedsV1: {
        en_US: 'Base URL likely needs /v1; current request resolved to {endpoint}',
        zh_CN: 'Base URL 很可能应包含 /v1；当前请求落到了 {endpoint}',
      },
      siliconFlowVerifyBaseUrl: {
        en_US: 'For SiliconFlow, first verify that Base URL is https://api.siliconflow.cn/v1',
        zh_CN: 'SiliconFlow 可优先检查 Base URL 是否填写为 https://api.siliconflow.cn/v1',
      },
      timeoutHint: {
        en_US: 'This was a timeout. Check Base URL and network connectivity first, then try Compact mode, fewer max tokens, or a longer timeout.',
        zh_CN: '这是请求超时。优先检查 Base URL、网络连通性，并尝试切换为“紧凑”、降低最大 Token 数或继续增大超时时间',
      },
      aiRequestTimedOut: {
        en_US: 'AI request timed out: {message}\n{hints}',
        zh_CN: 'AI 请求超时：{message}\n{hints}',
      },
      aiRequestFailed: {
        en_US: 'AI request failed: {message}\n{hints}',
        zh_CN: 'AI 请求失败：{message}\n{hints}',
      },
      responseSnippet: {
        en_US: '\nResponse snippet: {value}',
        zh_CN: '\n响应片段：{value}',
      },
      aiRequestFailedWithStatus: {
        en_US: 'AI request failed ({status}){details}{hintText}',
        zh_CN: 'AI 请求失败（{status}）{details}{hintText}',
      },
      repairTargetThemeReason: {
        en_US: 'Topic match hit {count} times and works as a stable entry point',
        zh_CN: '主题匹配命中 {count} 次，适合作为稳定入口',
      },
      repairTargetCoreReason: {
        en_US: 'High-reference core doc, referenced by {count} docs',
        zh_CN: '当前是高引用核心文档，被 {count} 个文档引用',
      },
      repairBenefitExitOrphanList: {
        en_US: 'Expected to leave the orphan doc list',
        zh_CN: '预计移出孤立文档列表',
      },
      repairBenefitAddInboundLink: {
        en_US: 'Add 1 inbound link to {title}',
        zh_CN: '为 {title} 增加 1 条入链',
      },
      repairBenefitRestoreEntryLink: {
        en_US: 'Restore one entry link to the current network',
        zh_CN: '为当前网络补回 1 个入口连接',
      },
      repairBenefitImproveTopicCoverage: {
        en_US: 'Improve topic coverage for {topics}',
        zh_CN: '补全 {topics} 主题的网络覆盖',
      },
      repairBenefitReduceSinkingRisk: {
        en_US: 'Reduce the risk of sinking further later',
        zh_CN: '降低后续继续沉没的风险',
      },
      repairTitle: {
        en_US: 'Repair orphan doc: {title}',
        zh_CN: '修复孤立文档：{title}',
      },
      repairEvidenceHistoricalLinks: {
        en_US: '{count} historical link traces exist',
        zh_CN: '历史上出现过 {count} 条连接证据',
      },
      repairEvidenceThemeMatch: {
        en_US: '{theme} topic match hit {count} times',
        zh_CN: '{theme} 主题匹配命中 {count} 次',
      },
      repairActionLinkTargets: {
        en_US: 'First link it to {targets}, then add one short note about which topic this note belongs to.',
        zh_CN: '先补到 {targets}，并补一句说明这篇笔记属于哪个主题。',
      },
      repairActionRestoreCoreNetwork: {
        en_US: 'First add one link back to the core network, then add one short note about the current doc topic.',
        zh_CN: '先补 1 条回到核心网络的连接，并补一句说明当前文档的归属主题。',
      },
      repairDraftFitUnder: {
        en_US: 'Can fit under {title}: (({documentId} "{title}"))',
        zh_CN: '可归入 {title}：(({documentId} "{title}"))',
      },
      topicPageTargetHubReason: {
        en_US: 'This is a hub doc in the current cluster and works well as an initial topic page entry.',
        zh_CN: '这是当前社区的 hub 文档，适合作为主题页的首批入口',
      },
      topicPageTitle: {
        en_US: 'Create topic page: {title}',
        zh_CN: '创建主题页：{title}',
      },
      topicPageEvidenceClusterSize: {
        en_US: 'Cluster size: {count} docs',
        zh_CN: '社区规模 {count} 篇文档',
      },
      topicPageEvidenceMissingTopicPage: {
        en_US: 'Missing topic page, recent link change {delta}',
        zh_CN: '当前缺少主题页，最近关系变化 {delta}',
      },
      topicPageEvidenceTopTags: {
        en_US: 'Top tags: {tags}',
        zh_CN: '高频标签：{tags}',
      },
      topicPageEvidenceWeakTopTags: {
        en_US: 'Top tag evidence is weak',
        zh_CN: '高频标签证据较弱',
      },
      topicPageActionCreateAndAttach: {
        en_US: 'Create {title}, then attach it first to {targets}.',
        zh_CN: '新建 {title}，并先挂入 {targets}。',
      },
      topicPageFallbackClusterHubDocs: {
        en_US: 'cluster hub docs',
        zh_CN: '社区 hub 文档',
      },
      topicPageBenefitUnifiedEntry: {
        en_US: 'Build one unified entry page for this cluster',
        zh_CN: '为该社区建立统一入口页',
      },
      topicPageBenefitBringDocsTogether: {
        en_US: 'Bring {count} docs into one navigable topic structure',
        zh_CN: '把 {count} 篇文档收束到可导航的主题结构中',
      },
      topicPageBenefitFollowUpFocused: {
        en_US: 'Follow-up link repair and archive work becomes more focused',
        zh_CN: '后续补链和归档动作会更集中',
      },
      topicPageDraftTitle: {
        en_US: 'Suggested topic page title: {title}',
        zh_CN: '建议主题页标题：{title}',
      },
      bridgeTargetHubReason: {
        en_US: 'Linking to neighboring cluster hubs can reduce this bridge becoming the only path.',
        zh_CN: '补到相邻社区 hub，可以减少该桥接点成为唯一路径',
      },
      bridgeTargetRelatedDocReason: {
        en_US: 'A highly connected doc in the current network that can act as an alternative entry point.',
        zh_CN: '当前网络中的高连接文档，可作为替代入口',
      },
      bridgeTitle: {
        en_US: 'Reduce bridge risk: {title}',
        zh_CN: '降低桥接风险：{title}',
      },
      bridgeEvidenceRelationshipCount: {
        en_US: 'Currently connects {count} relationships',
        zh_CN: '当前连接 {count} 条关系',
      },
      bridgeEvidenceAppearsInClusters: {
        en_US: 'Appears in {count} clusters',
        zh_CN: '同时出现在 {count} 个社区中',
      },
      bridgeEvidenceNoAlternativeClusterEntry: {
        en_US: 'No clear alternative cluster entry is available yet',
        zh_CN: '当前缺少明确的社区替代入口',
      },
      bridgeEvidenceCanLinkToTargets: {
        en_US: 'Can first link to {targets}',
        zh_CN: '可优先补到 {targets}',
      },
      bridgeEvidenceNoAlternativeTarget: {
        en_US: 'No sufficiently clear alternative target was found',
        zh_CN: '当前未找到足够清晰的替代目标',
      },
      bridgeActionAddNavigationToTargets: {
        en_US: 'Add an upstream/downstream navigation block in {title} and link explicitly to {targets}.',
        zh_CN: '在 {title} 中补一段上下游导航，显式链接到 {targets}。',
      },
      bridgeActionAvoidSingleBridgePoint: {
        en_US: 'Add an upstream/downstream navigation block for {title} so it does not become a single bridge point.',
        zh_CN: '为 {title} 补一段上下游导航，避免它成为单点桥接。',
      },
      bridgeBenefitReduceFragmentationRisk: {
        en_US: 'Reduce the risk of cluster fragmentation from a single bridge point',
        zh_CN: '降低单点桥接导致社区断裂的风险',
      },
      bridgeBenefitAddNavigationForAlternativeEntries: {
        en_US: 'Add navigation for {count} alternative entry points',
        zh_CN: '为 {count} 个替代入口补齐导航',
      },
      bridgeBenefitAddAlternativeEntries: {
        en_US: 'Add alternative entries for neighboring topics',
        zh_CN: '为相邻主题补出替代入口',
      },
      bridgeDraftEntries: {
        en_US: 'Upstream/downstream entries: {entries}',
        zh_CN: '上游/下游入口：{entries}',
      },
      archiveTargetThemeReason: {
        en_US: 'If this still has value, linking it to a topic page before archiving makes it easier to revisit later.',
        zh_CN: '如果仍有保留价值，先补到主题页再归档更容易回查',
      },
      archiveTargetCoreReason: {
        en_US: 'You can first link it to an active index entry, then decide whether to archive it.',
        zh_CN: '可先补到一个仍活跃的索引入口，再决定是否归档',
      },
      archiveTitle: {
        en_US: 'Handle dormant doc: {title}',
        zh_CN: '处理沉没文档：{title}',
      },
      archiveEvidenceDaysWithoutLinks: {
        en_US: '{count} days without valid links',
        zh_CN: '{count} 天未产生有效连接',
      },
      archiveEvidenceHistoricalLinks: {
        en_US: '{count} historical link traces exist',
        zh_CN: '历史上出现过 {count} 条连接证据',
      },
      archiveActionKeepLookupEntry: {
        en_US: 'First link it to {title} to keep a lookup entry; archive it later if you stop maintaining it.',
        zh_CN: '先补到 {title} 留下回查入口；如果后续不再维护，再归档。',
      },
      archiveActionConfirmThenArchive: {
        en_US: 'First confirm whether it still needs to be kept. If not, archive it and add one index note.',
        zh_CN: '先确认是否仍需保留；如无持续维护计划，归档并补一条索引说明。',
      },
      archiveBenefitReduceBuildup: {
        en_US: 'Reduce buildup of dormant docs',
        zh_CN: '减少沉没文档堆积',
      },
      archiveBenefitKeepLookupEntry: {
        en_US: 'Keep a necessary lookup entry and avoid losing it completely later',
        zh_CN: '保留必要回查入口，避免后续完全失联',
      },
      untitledTopic: {
        en_US: 'Untitled topic',
        zh_CN: '未命名主题',
      },
      suggestedTopicPageTitle: {
        en_US: 'Topic-{topic}-Index',
        zh_CN: '主题-{topic}-索引',
      },
    },
    largeDocuments: {
      badgeWords: {
        en_US: 'Text count {count}',
        zh_CN: '正文统计 {count}',
      },
      metaWords: {
        en_US: 'Text count {count} · Threshold {threshold} · Updated {date}',
        zh_CN: '正文统计 {count} · 阈值 {threshold} · 更新于 {date}',
      },
      metaStorage: {
        en_US: 'Total size {totalSize} · Threshold {threshold} · {assetCount} assets',
        zh_CN: '总大小 {totalSize} · 阈值 {threshold} · {assetCount} 个资源',
      },
    },
    wikiPage: {
      managedRootHeading: {
        en_US: 'AI managed area',
        zh_CN: 'AI 管理区',
      },
      metaHeading: {
        en_US: 'Page meta',
        zh_CN: '页面头信息',
      },
      overviewHeading: {
        en_US: 'Topic overview',
        zh_CN: '主题概览',
      },
      keyDocumentsHeading: {
        en_US: 'Key documents',
        zh_CN: '关键文档',
      },
      structureObservationsHeading: {
        en_US: 'Structure observations',
        zh_CN: '结构观察',
      },
      evidenceHeading: {
        en_US: 'Relationship evidence',
        zh_CN: '关系证据',
      },
      actionsHeading: {
        en_US: 'Cleanup actions',
        zh_CN: '整理动作',
      },
      sourcesHeading: {
        en_US: 'References',
        zh_CN: '参考来源',
      },
    },
    documentDetailDescription: {
      en_US: 'Follow the active document and summarize its community role, bridge position, and dormant risk.',
      zh_CN: '跟随当前文档，概览其社区角色、桥接位置与沉没风险。',
    },
    suggestionType: {
      promoteHub: {
        en_US: 'Promote to topic page',
        zh_CN: '提升为主题页',
      },
      repairOrphan: {
        en_US: 'Repair links',
        zh_CN: '补齐链接',
      },
      maintainBridge: {
        en_US: 'Maintain bridge',
        zh_CN: '维护桥接',
      },
      archiveDormant: {
        en_US: 'Archive dormant',
        zh_CN: '归档沉没',
      },
    },
  },
} as const

type DotJoin<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]:
    T[K] extends UiTextMap
      ? DotJoin<Prefix, K>
      : T[K] extends Record<string, unknown>
        ? LeafPaths<T[K], DotJoin<Prefix, K>>
        : never
}[keyof T & string]

export type UiTextKey = LeafPaths<typeof UI_TEXT>

export function normalizeUiLocale(locale?: string | null): UiLocale {
  const normalized = (locale ?? '').trim().toLowerCase()
  if (normalized.startsWith('zh')) {
    return 'zh_CN'
  }
  return 'en_US'
}

export function resolveUiLocale(): UiLocale {
  const globalValue = globalThis as typeof globalThis & {
    siyuan?: {
      config?: {
        lang?: string
      }
    }
  }

  return normalizeUiLocale(globalValue.siyuan?.config?.lang ?? 'en_US')
}

export function resolveUiLanguageTag(locale = resolveUiLocale()): 'en-US' | 'zh-CN' {
  return locale === 'zh_CN' ? 'zh-CN' : 'en-US'
}

export function pickUiText(text: UiTextMap, locale = resolveUiLocale()): string {
  return locale === 'zh_CN' ? text.zh_CN : text.en_US
}

function interpolateUiText(template: string, params?: UiInterpolationParams): string {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) {
      return match
    }
    return String(params[name])
  })
}

function getUiTextMap(key: UiTextKey): UiTextMap {
  const segments = key.split('.')
  let current: unknown = UI_TEXT

  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      throw new Error(`Unknown UI text key: ${key}`)
    }
    current = (current as Record<string, unknown>)[segment]
  }

  if (!current || typeof current !== 'object' || !('en_US' in current) || !('zh_CN' in current)) {
    throw new Error(`Invalid UI text entry: ${key}`)
  }

  return current as UiTextMap
}

export function t(key: UiTextKey, paramsOrLocale?: UiInterpolationParams | UiLocale, localeArg?: UiLocale): string {
  const params = typeof paramsOrLocale === 'object' && paramsOrLocale !== null ? paramsOrLocale : undefined
  const locale = typeof paramsOrLocale === 'string' ? paramsOrLocale : (localeArg ?? resolveUiLocale())
  return interpolateUiText(pickUiText(getUiTextMap(key), locale), params)
}
