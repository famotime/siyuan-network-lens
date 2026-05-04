import type { SourceBlockItem } from './ai-index-store'

export interface SourceBlockCandidate {
  blockId: string
  text: string
  type: string
  charCount: number
}

export interface ClassifiedSourceBlocks {
  primary: SourceBlockItem[]
  secondary: SourceBlockItem[]
}

const PRIMARY_CHAR_THRESHOLD = 80
const SECONDARY_CHAR_THRESHOLD = 30
const MAX_PRIMARY_BLOCKS = 8
const MAX_SECONDARY_BLOCKS = 12
const MAX_BLOCKS_TO_READ = 50

const LOW_VALUE_TYPES = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr',
])

const BLOCK_REF_PATTERN = /\(\([0-9a-f]{22}\s+"[^"]*"\)\)/g
const INLINE_MATH_PATTERN = /\$[^$]+\$/g
const KRAMDOWN_ATTRIBUTE_PATTERN = /\{:[^}]*\}/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g
const MARKDOWN_LINK_ONLY_PATTERN = /^\s*(?:\[([^\]]*)\]\([^)]*\)\s*)+$/

export async function collectDocumentSourceBlocks(params: {
  documentId: string
  getChildBlocks: (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
}): Promise<ClassifiedSourceBlocks> {
  const childBlocks = await params.getChildBlocks(params.documentId)

  const blocksToRead = childBlocks.length > MAX_BLOCKS_TO_READ
    ? sampleBlocks(childBlocks, MAX_BLOCKS_TO_READ)
    : childBlocks

  const candidates: SourceBlockCandidate[] = []

  for (const block of blocksToRead) {
    const blockId = block.id
    const blockType = block.type || block.subtype || ''

    if (LOW_VALUE_TYPES.has(blockType)) {
      continue
    }

    try {
      const { kramdown } = await params.getBlockKramdown(blockId)
      const plainText = stripKramdownMarkers(kramdown)

      if (!plainText || plainText.length < SECONDARY_CHAR_THRESHOLD) {
        continue
      }

      candidates.push({
        blockId,
        text: plainText,
        type: blockType,
        charCount: plainText.length,
      })
    } catch {
      // skip blocks that fail to load
    }
  }

  const filtered = filterLowValueBlocks(candidates)
  return classifySourceBlocks(filtered)
}

export function filterLowValueBlocks(candidates: SourceBlockCandidate[]): SourceBlockCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.charCount < SECONDARY_CHAR_THRESHOLD) {
      return false
    }

    if (MARKDOWN_LINK_ONLY_PATTERN.test(candidate.text)) {
      return false
    }

    if (isPureFormatting(candidate.text)) {
      return false
    }

    return true
  })
}

export function classifySourceBlocks(filtered: SourceBlockCandidate[]): ClassifiedSourceBlocks {
  const primary: SourceBlockItem[] = []
  const secondary: SourceBlockItem[] = []

  for (const candidate of filtered) {
    if (candidate.charCount >= PRIMARY_CHAR_THRESHOLD && primary.length < MAX_PRIMARY_BLOCKS) {
      primary.push({ blockId: candidate.blockId, text: candidate.text })
    } else if (secondary.length < MAX_SECONDARY_BLOCKS) {
      secondary.push({ blockId: candidate.blockId, text: candidate.text })
    }
  }

  return { primary, secondary }
}

function sampleBlocks<T>(blocks: T[], limit: number): T[] {
  if (blocks.length <= limit) {
    return blocks
  }

  const step = (blocks.length - 1) / (limit - 1)
  const sampled: T[] = []
  for (let i = 0; i < limit; i++) {
    sampled.push(blocks[Math.round(i * step)])
  }
  return sampled
}

function stripKramdownMarkers(kramdown: string): string {
  return kramdown
    .replace(BLOCK_REF_PATTERN, '')
    .replace(INLINE_MATH_PATTERN, '')
    .replace(KRAMDOWN_ATTRIBUTE_PATTERN, '')
    .replace(MARKDOWN_IMAGE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPureFormatting(text: string): boolean {
  const stripped = text.replace(/[*_~`#>|]/g, '').trim()
  return stripped.length < SECONDARY_CHAR_THRESHOLD
}
