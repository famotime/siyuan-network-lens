import type { DocumentRecord } from './analysis'
import type { AiInboxPayload } from './ai-inbox'
import type { AiLinkSuggestionResult } from './ai-link-suggestions'
import type { ClassifiedSourceBlocks } from './document-index-source-blocks'
import type { LlmPromptSpec } from './llm-prompt-types'
import { normalizeTags, resolveDocumentTitle } from './document-utils'
import { t, type UiLocale } from '@/i18n/ui'

export interface AiLinkSuggestionPromptInput {
  uiLanguage: UiLocale
  sourceDocument: {
    id: string
    title: string
    hpath?: string
    tags: string[]
    contentPreview: string
    historicalReferenceCount: number
    hasSparseEvidence: boolean
  }
  availableThemes: Array<{
    documentId: string
    title: string
    themeName: string
    matchTerms: string[]
    hpath?: string
  }>
  existingTags: string[]
  candidates: Array<{
    id: string
    title: string
    targetType: string
    baseScore: number
    finalScore: number
    reasons: string[]
  }>
}

const AI_INBOX_SYSTEM_PROMPT = [
  'You are a knowledge-organization assistant for a SiYuan note library.',
  'Based on recently collected or created notes and related network analysis signals, output the highest-priority cleanup tasks for today. The goal is to turn scattered notes into a topic-centered knowledge structure.',
  'You must return JSON only. Do not output Markdown, explanations, or code blocks.',
  'The JSON shape must be {"summary": string, "items": AiInboxItem[]}.',
  'Each item must include id, type, title, priority, action, and reason, with optional documentIds, confidence, recommendedTargets, evidence, expectedChanges, and priorityBreakdown.',
  'type must be one of document, connection, topic-page, or bridge-risk.',
  'priority must be P1, P2, or P3.',
  'Prefer using the recommended targets, evidence, estimated gains, and scores already provided in actionCandidates. Do not invent documents or topic pages that do not exist.',
  'If an actionCandidate includes focusDocumentIds, put the related primary object ids into documentIds.',
  'If recommendedTargets exist, action must mention the target titles explicitly instead of generic actions like "repair links" or "improve structure".',
  'action should be directly usable as user-visible recommended action text.',
  'reason should be directly usable as user-visible why-this-first text and must cite at least one structure signal.',
  'Prioritize orphan docs, dormant docs, bridge risks, communities missing topic pages, trend changes, and critical link repair.',
  'All user-visible text fields must follow the user interface language of the current workspace. Keep proper nouns such as document titles, tag names, and model names as needed.',
].join(' ')

const AI_LINK_SUGGESTION_SYSTEM_PROMPT = [
  'You are a link-repair assistant for SiYuan notes.',
  'Only choose from the provided candidate targets. Do not invent documents that do not exist.',
  'You must return JSON in the format {"summary": string, "suggestions": Suggestion[] }.',
  'Each Suggestion must include targetDocumentId, targetTitle, targetType, confidence, and reason, with optional draftText and tagSuggestions.',
  'reason must merge the recommendation basis and the main expected improvement into one concise explanation.',
  'tagSuggestions is an array of tag suggestions. Each item includes tag, source, and reason; source can only be existing or new.',
  'For tag suggestions, actively propose both: (1) existing tags from the existingTags list that fit the document content, and (2) new tags that do not exist yet but would be reasonable and useful for organizing the document. New tags should follow the naming style and granularity of the existing tags.',
  'If a topic page is clearly suitable, prefer recommending the topic page.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

const AI_LINK_REWRITE_SYSTEM_PROMPT = [
  'You normalize SiYuan link suggestion JSON into the requested workspace language.',
  'Return JSON only.',
  'Keep targetDocumentId, targetTitle, targetType, confidence, tag text, and source unchanged.',
  'Only rewrite summary, reason, draftText, and tagSuggestions.reason.',
  'Do not add, remove, or reorder suggestions or tagSuggestions.',
].join(' ')

const AI_DOCUMENT_EVIDENCE_SYSTEM_PROMPT = `You are an evidence compiler for a personal knowledge base. Read a document and its evidence blocks, then produce a structured index.

Return ONLY a valid JSON object. No markdown fences, no explanation, no extra text before or after the JSON.

Required JSON structure:
{
  "positioning": "one sentence describing the document topic",
  "propositions": [
    { "text": "a factual claim from the document", "sourceBlockIds": ["block-id-1"] }
  ],
  "keywords": ["keyword1", "keyword2"]
}

Field rules:

positioning - One sentence (under 120 chars). Neutral description of what the document covers. No evaluative language.

propositions - 3 to 6 items. Each is a factual claim or key idea from the document. Each must:
  - Be self-contained and understandable without reading the document
  - Reference at least one sourceBlockId from the evidence blocks provided
  - Use neutral language, no "this document explains" or similar
  - Keep each proposition under 100 characters

keywords - 5 to 8 keywords. Mix specific terms and broader concepts.

IMPORTANT:
- sourceBlockIds must be real block IDs from the evidence blocks below
- All text in the same language as the document
- Return ONLY the JSON object, nothing else`

export function buildAiInboxPrompt(params: {
  payload: AiInboxPayload
}): LlmPromptSpec {
  return {
    id: 'ai-inbox.generate',
    version: 1,
    expectedJsonSchemaName: 'AiInboxResult',
    messages: [
      { role: 'system', content: AI_INBOX_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          t('analytics.aiInbox.promptProduceUnifiedTaskList'),
          t('analytics.aiInbox.promptPreferHighScoringCandidates'),
          t('analytics.aiInbox.promptKeepStructureCompact'),
          t('analytics.aiInbox.promptMakeActionSpecific'),
          t('analytics.aiInbox.promptDoNotFabricateWeakEvidence'),
          JSON.stringify(params.payload),
        ].join('\n'),
      },
    ],
  }
}

export function buildAiConnectionTestPrompt(): LlmPromptSpec {
  return {
    id: 'ai.connection-test',
    version: 1,
    messages: [
      { role: 'system', content: 'You are a connection test assistant. Return OK only.' },
      { role: 'user', content: 'Reply with OK only.' },
    ],
  }
}

export function buildAiDocumentEvidencePrompt(params: {
  sourceDocument: DocumentRecord
  sourceBlocks: ClassifiedSourceBlocks
}): LlmPromptSpec {
  const title = resolveDocumentTitle(params.sourceDocument)
  const tags = normalizeTags(params.sourceDocument.tags)
  const allBlocks = [...params.sourceBlocks.primary, ...params.sourceBlocks.secondary]
  const blockSection = allBlocks.length > 0
    ? allBlocks.map(block => `[${block.blockId}] ${block.text}`).join('\n\n')
    : '(No evidence blocks extracted)'

  return {
    id: 'ai-document.evidence-compile',
    version: 1,
    expectedJsonSchemaName: 'EvidenceCompilationResult',
    messages: [
      {
        role: 'system',
        content: AI_DOCUMENT_EVIDENCE_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          `Document: ${title}`,
          params.sourceDocument.hpath ? `Path: ${params.sourceDocument.hpath}` : '',
          tags.length ? `Tags: ${tags.join(', ')}` : '',
          '',
          'Evidence blocks:',
          blockSection,
        ].filter(Boolean).join('\n'),
      },
    ],
  }
}

export function buildAiLinkSuggestionPrompt(params: {
  locale: UiLocale
  input: AiLinkSuggestionPromptInput
}): LlmPromptSpec {
  const targetLanguage = params.locale === 'zh_CN' ? 'Simplified Chinese' : 'English'
  return {
    id: 'ai-link.suggest',
    version: 1,
    expectedJsonSchemaName: 'AiLinkSuggestionResult',
    messages: [
      {
        role: 'system',
        content: `${AI_LINK_SUGGESTION_SYSTEM_PROMPT} Current workspace locale is ${params.locale}. Write summary, reason, draftText, and tagSuggestions.reason in ${targetLanguage}.`,
      },
      {
        role: 'user',
        content: JSON.stringify(params.input),
      },
    ],
  }
}

export function buildAiLinkRewritePrompt(params: {
  locale: UiLocale
  result: AiLinkSuggestionResult
}): LlmPromptSpec {
  const targetLanguage = params.locale === 'zh_CN' ? 'Simplified Chinese' : 'English'
  return {
    id: 'ai-link.rewrite',
    version: 1,
    expectedJsonSchemaName: 'AiLinkSuggestionResult',
    messages: [
      {
        role: 'system',
        content: `${AI_LINK_REWRITE_SYSTEM_PROMPT} Rewrite the user-visible copy into ${targetLanguage}.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          locale: params.locale,
          summary: params.result.summary,
          suggestions: params.result.suggestions,
        }),
      },
    ],
  }
}
