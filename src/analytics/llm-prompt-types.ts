export type LlmPromptRole = 'system' | 'user' | 'assistant'

export interface LlmPromptMessage {
  role: LlmPromptRole
  content: string
}

export interface LlmPromptSpec {
  id: string
  version: number
  messages: LlmPromptMessage[]
  expectedJsonSchemaName?: string
}
