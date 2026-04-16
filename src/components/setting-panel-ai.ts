import { pickUiText } from '@/i18n/ui'

const uiText = (en_US: string, zh_CN: string) => pickUiText({ en_US, zh_CN })

export function getAiFieldTooltips() {
  return {
    baseUrl: uiText(
      'OpenAI-compatible services usually require a /v1 suffix, for example https://api.siliconflow.cn/v1',
      '兼容 OpenAI 的服务通常需要 /v1 后缀，例如 https://api.siliconflow.cn/v1',
    ),
    embeddingModel: uiText(
      'Optional. Improves AI link recall for orphan docs; leave blank to use topic and structure signals. For SiliconFlow, use BAAI/bge-m3, BAAI/bge-large-zh-v1.5, or Qwen/Qwen3-Embedding-* instead of OpenAI model names like text-embedding-3-small.',
      '可选。可提升孤立文档 AI 补链召回；留空则仅使用主题和结构信号。对于 SiliconFlow，请使用 BAAI/bge-m3、BAAI/bge-large-zh-v1.5 或 Qwen/Qwen3-Embedding-*，不要使用 text-embedding-3-small 这类 OpenAI 模型名。',
    ),
    timeout: uiText('Request timeout in seconds', '请求超时秒数'),
    maxTokens: uiText('The max_tokens value sent to the API, used to limit generated output length', '发送给 API 的 max_tokens，用于限制生成长度'),
    temperature: uiText('The temperature value sent to the API, used to control randomness', '发送给 API 的 temperature，用于控制随机性'),
    maxContextMessages: uiText('Maximum context messages sent to the API', '发送给 API 的最大上下文消息数'),
    siliconFlowChatModel: uiText('Automatically load SiliconFlow chat models when the select opens', '打开下拉时自动加载 SiliconFlow 聊天模型清单'),
    siliconFlowEmbeddingModel: uiText('Automatically load SiliconFlow embedding models when the select opens', '打开下拉时自动加载 SiliconFlow embedding 模型清单'),
  } as const
}

export function shouldAutoLoadSiliconFlowModelCatalog(params: {
  apiKey?: string
  loading: boolean
  loaded: boolean
  error: string
}) {
  if (!params.apiKey?.trim()) {
    return false
  }
  if (params.loading) {
    return false
  }
  return !params.loaded || Boolean(params.error)
}

export function buildSiliconFlowModelSelectPlaceholder(params: {
  kind: 'chat' | 'embedding'
  apiKey?: string
  loading: boolean
  loaded: boolean
  error: string
  optionCount: number
}) {
  if (!params.apiKey?.trim()) {
    return uiText('Enter API Key first', '请先填写 API Key')
  }
  if (params.loading) {
    return params.kind === 'chat'
      ? uiText('Loading chat models...', '正在加载聊天模型...')
      : uiText('Loading embedding models...', '正在加载 embedding 模型...')
  }
  if (params.error) {
    return uiText('Load failed, click to retry', '加载失败，点击重试')
  }
  if (params.loaded || params.optionCount > 0) {
    return params.kind === 'chat'
      ? uiText('Select chat model', '请选择聊天模型')
      : uiText('Select embedding model', '请选择 embedding 模型')
  }
  return params.kind === 'chat'
    ? uiText('Click to load chat models', '点击加载聊天模型')
    : uiText('Click to load embedding models', '点击加载 embedding 模型')
}
