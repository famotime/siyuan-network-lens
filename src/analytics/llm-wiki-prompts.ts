import type { WikiThemeBundle } from './wiki-generation'
export type { LlmPromptMessage, LlmPromptRole, LlmPromptSpec } from './llm-prompt-types'
import type { LlmPromptSpec } from './llm-prompt-types'
import type { WikiPagePlan, WikiSectionType, WikiTemplateDiagnosis } from './wiki-template-model'
import { resolveUiLocale, type UiLocale } from '@/i18n/ui'

export const LLM_WIKI_THEME_PROMPT_VERSIONS = {
  'llm-wiki.theme.diagnosis': 1,
  'llm-wiki.theme.plan': 1,
  'llm-wiki.theme.section': 1,
} as const

const THEME_PROMPT_TEXT = {
  en_US: {
    diagnoseThemeTemplate: 'Diagnose the best wiki template for the current theme wiki page. Theme: {theme}.',
    diagnoseThemeTemplateSchema: 'Return JSON only with templateType, confidence, reason, enabledModules, suppressedModules, and evidenceSummary.',
    planThemePage: 'Generate a wiki page plan from the diagnosis for the current theme. Theme: {theme}.',
    planThemePageSchema: 'Return JSON only with templateType, confidence, coreSections, optionalSections, sectionOrder, sectionGoals, and sectionFormats.',
    generateThemeSection: 'Generate exactly one wiki section draft for the current theme. Theme: {theme}. Section type: {sectionType}.',
    generateThemeSectionSchema: 'Return JSON only with sectionType, title, format, blocks, and sourceRefs. Each block must include text and sourceRefs. Populate sourceRefs with documentId values (not blockId) from the provided source documents that support each block.',
    conservativeFallback: 'If evidence is weak in any section, respond conservatively with "No clear ..." instead of inventing content.',
    conflictSection: 'When sectionType is "conflict": Identify genuine contradictions: opposing conclusions, mutually exclusive claims, or directly conflicting recommendations on the same topic across different source documents. Do NOT classify complementary perspectives, different angles, or progressive elaboration as conflicts. Each conflict entry MUST cite at least one sourceRef. Opposing sides of the same conflict MUST reference different source documents. Use the existing sourceRefs mechanism for citation (documentId + sequential number). If no genuine conflicts exist among the source documents, return an empty blocks array.',
    incrementalMode: 'You are in incremental update mode. The existing wiki page content is provided as context. Preserve parts unaffected by changed documents. Update or supplement parts affected by new/changed documents. Remove references to deleted documents. Output complete updated sections (not fragments).',
    fullContent: 'The following are the full original content of each source document. Use them as the primary evidence for wiki generation instead of the index data in the JSON payload.',
  },
  zh_CN: {
    diagnoseThemeTemplate: '请诊断当前主题 wiki 最适合的模板类型。主题：{theme}。',
    diagnoseThemeTemplateSchema: '请只返回 JSON，并包含 templateType、confidence、reason、enabledModules、suppressedModules、evidenceSummary。',
    planThemePage: '请基于模板诊断结果规划主题 wiki 页面结构。主题：{theme}。',
    planThemePageSchema: '请只返回 JSON，并包含 templateType、confidence、coreSections、optionalSections、sectionOrder、sectionGoals、sectionFormats。',
    generateThemeSection: '请只生成一个 wiki 章节草稿。主题：{theme}。章节类型：{sectionType}。',
    generateThemeSectionSchema: '请只返回 JSON，并包含 sectionType、title、format、blocks、sourceRefs。每个 block 必须包含 text 和 sourceRefs。请使用所提供的源文档 documentId（非 blockId）填充每个 block 的 sourceRefs。',
    conservativeFallback: '如果某部分证据不足，可以保守输出“暂无明显...”而不是编造。',
    conflictSection: '当 sectionType 为 "conflict" 时：识别真正的矛盾——同一主题下不同源文档中的对立结论、互斥主张或直接冲突的建议。不要将互补视角、不同角度或递进阐述误判为冲突。每个冲突条目必须引用至少一个 sourceRef。同一冲突的对立双方必须引用不同的源文档。使用现有 sourceRefs 机制进行引用（documentId + 序号）。如果源文档间不存在真正的冲突，返回空的 blocks 数组。',
    incrementalMode: '你正处于增量更新模式。现有 wiki 页面内容作为上下文提供。保留未受变化文档影响的部分。更新或补充受新增/变化文档影响的部分。移除已删除文档相关的引用和内容。输出完整的更新后章节（非片段）。',
    fullContent: '以下是各源文档的完整原文内容，请优先以此为依据生成 Wiki 内容，而非 JSON payload 中的索引数据。',
  },
} as const

const BASE_THEME_SYSTEM_PROMPT = [
  'You are a topic wiki maintenance assistant for SiYuan notes.',
  'Base every answer on the provided topic page bundle, source document bundles, template signals, and analysis signals.',
  'Return JSON only.',
  'Do not output Markdown, explanations, or code blocks.',
  'Do not invent documents, topic pages, relationships, evidence, or user-visible claims that are not grounded in the input.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

export function buildThemeDiagnosisPrompt(params: {
  payload: WikiThemeBundle
  existingWikiContent?: string
}): LlmPromptSpec {
  return {
    id: 'llm-wiki.theme.diagnosis',
    version: 1,
    expectedJsonSchemaName: 'WikiTemplateDiagnosis',
    messages: [
      {
        role: 'system',
        content: [
          BASE_THEME_SYSTEM_PROMPT,
          'Diagnose the best wiki template for the current theme.',
          'The JSON must include templateType, confidence, reason, enabledModules, suppressedModules, and evidenceSummary.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          formatThemePrompt('diagnoseThemeTemplate', { theme: params.payload.themeName }),
          themePromptText('diagnoseThemeTemplateSchema'),
          themePromptText('conservativeFallback'),
          ...buildIncrementalPromptParts(params.existingWikiContent),
          ...buildFullContentParts(params.payload),
          JSON.stringify({ payload: params.payload }),
        ].join('\n'),
      },
    ],
  }
}

export function buildThemePagePlanPrompt(params: {
  payload: WikiThemeBundle
  diagnosis: WikiTemplateDiagnosis
  existingWikiContent?: string
}): LlmPromptSpec {
  return {
    id: 'llm-wiki.theme.plan',
    version: 1,
    expectedJsonSchemaName: 'WikiPagePlan',
    messages: [
      {
        role: 'system',
        content: [
          BASE_THEME_SYSTEM_PROMPT,
          'Generate a wiki page plan for the diagnosed theme template.',
          'The JSON must include templateType, confidence, coreSections, optionalSections, sectionOrder, sectionGoals, and sectionFormats.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          formatThemePrompt('planThemePage', { theme: params.payload.themeName }),
          themePromptText('planThemePageSchema'),
          themePromptText('conservativeFallback'),
          ...buildIncrementalPromptParts(params.existingWikiContent),
          ...buildFullContentParts(params.payload),
          JSON.stringify({ payload: params.payload, diagnosis: params.diagnosis }),
        ].join('\n'),
      },
    ],
  }
}

export function buildThemeSectionPrompt(params: {
  payload: WikiThemeBundle
  diagnosis: WikiTemplateDiagnosis
  pagePlan: WikiPagePlan
  sectionType: WikiSectionType
  existingWikiContent?: string
}): LlmPromptSpec {
  const systemParts = [
    BASE_THEME_SYSTEM_PROMPT,
    'Generate exactly one wiki section draft.',
    'The JSON must include sectionType, title, format, blocks, and sourceRefs.',
    'Each block must include text and sourceRefs.',
    'For every block, populate sourceRefs with the documentId values from the provided source documents that best support that block content. Use documentId, never blockId.',
    'For the sources (catalog) section, each block sourceRefs must include all relevant source documentIds so the renderer can produce explicit reference entries.',
    'For the intro (overview) section, each block text must be a concise self-contained summary sentence. Do not include block IDs, document IDs, or technical identifiers in the visible text.',
  ]
  if (params.sectionType === 'conflict') {
    systemParts.push(themePromptText('conflictSection'))
  }

  return {
    id: 'llm-wiki.theme.section',
    version: 1,
    expectedJsonSchemaName: 'WikiSectionDraft',
    messages: [
      {
        role: 'system',
        content: systemParts.join(' '),
      },
      {
        role: 'user',
        content: [
          formatThemePrompt('generateThemeSection', { theme: params.payload.themeName, sectionType: params.sectionType }),
          themePromptText('generateThemeSectionSchema'),
          themePromptText('conservativeFallback'),
          ...buildIncrementalPromptParts(params.existingWikiContent),
          ...buildFullContentParts(params.payload),
          JSON.stringify({
            payload: params.payload,
            diagnosis: params.diagnosis,
            pagePlan: params.pagePlan,
            sectionType: params.sectionType,
          }),
        ].join('\n'),
      },
    ],
  }
}

export function buildSinglePageMaintenancePrompt(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  brokenLinkIds: string[]
  locale?: UiLocale
}): LlmPromptSpec {
  const locale = params.locale ?? resolveUiLocale()
  return {
    id: 'llm-wiki.page.maintenance',
    version: 1,
    expectedJsonSchemaName: 'WikiMaintenanceResult',
    messages: [
      {
        role: 'system',
        content: [
          'You are a wiki page maintenance assistant for SiYuan notes.',
          'Review the provided wiki page content and check for:',
          '1. Broken document ID links (siyuan://blocks/<id> pointing to non-existent documents)',
          '2. Outdated sections (content that should be updated based on source documents)',
          '3. Missing references (source documents not linked from the wiki page)',
          'Return JSON with two fields: "suggestions" (array of {type, description, sectionHeading?}) and "revisedMarkdown" (the corrected full wiki page content).',
          '如果界面语言是中文，请使用中文输出 suggestions.description 和 revisedMarkdown。',
          'Do not invent content not grounded in the source materials.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildMaintenanceUserContent({ ...params, locale }),
      },
    ],
  }
}

export function buildWikiRoutePrompt(params: {
  question: string
  pageTitles: string[]
  pageSummaries?: string[]
}): LlmPromptSpec {
  return {
    id: 'llm-wiki.chat.route',
    version: 1,
    messages: [
      {
        role: 'system',
        content: [
          'You are a topic routing assistant for SiYuan notes.',
          'Given a user question and a list of wiki page titles, return ONLY the single most relevant page title.',
          'Return the exact title string, nothing else.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildRouteUserContent(params),
      },
    ],
  }
}

export function buildWikiChatPrompt(params: {
  question: string
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): LlmPromptSpec {
  return {
    id: 'llm-wiki.chat.answer',
    version: 1,
    expectedJsonSchemaName: 'WikiChatResult',
    messages: [
      {
        role: 'system',
        content: [
          'You are a knowledge assistant for SiYuan notes.',
          'Answer the user question based on the provided wiki page content.',
          'If you need to reference specific source documents mentioned in the wiki page, include their document IDs in your response.',
          'Return JSON with two fields: "answer" (string) and "referencedDocumentIds" (string array, empty if no source documents were needed).',
          'Do not invent information not present in the provided context.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildChatUserContent(params),
      },
    ],
  }
}

export function buildWikiContextMessage(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  const parts = [
    `Wiki page: ${params.wikiPageTitle}`,
    '',
    'Wiki page content:',
    params.wikiPageMarkdown,
  ]
  if (params.sourceDocuments?.length) {
    parts.push('', 'Referenced source documents:')
    for (const doc of params.sourceDocuments) {
      parts.push(`--- Document: ${doc.title} (ID: ${doc.id}) ---`)
      parts.push(doc.markdown.slice(0, 3000))
      parts.push('')
    }
  }
  return parts.join('\n')
}

function buildIncrementalPromptParts(existingWikiContent?: string): string[] {
  if (!existingWikiContent) {
    return []
  }
  return [
    themePromptText('incrementalMode'),
    `Existing wiki page content:\n${existingWikiContent}`,
  ]
}

function buildFullContentParts(payload: WikiThemeBundle): string[] {
  const fullContentDocs = payload.sourceDocuments.filter(doc => doc.fullContent)
  if (fullContentDocs.length === 0) {
    return []
  }
  const parts: string[] = [themePromptText('fullContent')]
  for (const doc of fullContentDocs) {
    parts.push(`--- Document: ${doc.title} (ID: ${doc.documentId}) ---`)
    parts.push(doc.fullContent!)
    parts.push('')
  }
  return parts
}

function themePromptText(key: keyof typeof THEME_PROMPT_TEXT['en_US']): string {
  return THEME_PROMPT_TEXT[resolveUiLocale()][key]
}

function formatThemePrompt(
  key: keyof typeof THEME_PROMPT_TEXT['en_US'],
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (text, [placeholder, value]) => text.replaceAll(`{${placeholder}}`, value),
    themePromptText(key),
  )
}

function buildMaintenanceUserContent(params: {
  wikiPageTitle: string
  wikiPageMarkdown: string
  brokenLinkIds: string[]
  locale?: UiLocale
}): string {
  const localeLine = params.locale === 'zh_CN'
    ? '界面语言：中文，请优先使用中文输出。'
    : 'UI language: English.'
  const parts = [
    `页面标题：${params.wikiPageTitle}`,
    localeLine,
    '',
    '页面内容：',
    params.wikiPageMarkdown,
  ]
  if (params.brokenLinkIds.length) {
    parts.push('', params.locale === 'zh_CN'
      ? `确认失效的块 ID：${params.brokenLinkIds.join(', ')}`
      : `Confirmed broken link IDs: ${params.brokenLinkIds.join(', ')}`)
  }
  return parts.join('\n')
}

function buildRouteUserContent(params: {
  question: string
  pageTitles: string[]
  pageSummaries?: string[]
}): string {
  const lines = [
    `User question: ${params.question}`,
    '',
    'Available wiki pages:',
  ]
  for (let i = 0; i < params.pageTitles.length; i++) {
    const summary = params.pageSummaries?.[i]
    if (summary) {
      lines.push(`${i + 1}. ${params.pageTitles[i]}`)
      lines.push(`   Summary: ${summary}`)
    } else {
      lines.push(`${i + 1}. ${params.pageTitles[i]}`)
    }
  }
  lines.push('', 'Return the single most relevant page title:')
  return lines.join('\n')
}

function buildChatUserContent(params: {
  question: string
  wikiPageTitle: string
  wikiPageMarkdown: string
  sourceDocuments?: Array<{ id: string, title: string, markdown: string }>
}): string {
  return [
    buildWikiContextMessage({
      wikiPageTitle: params.wikiPageTitle,
      wikiPageMarkdown: params.wikiPageMarkdown,
      sourceDocuments: params.sourceDocuments,
    }),
    '',
    `User question: ${params.question}`,
  ].join('\n')
}
