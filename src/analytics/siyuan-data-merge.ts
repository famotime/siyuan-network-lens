import type { ReferenceRecord } from './analysis'

export function mergeReferences(primary: ReferenceRecord[], fallback: ReferenceRecord[]): ReferenceRecord[] {
  const merged = [...primary]
  const existingSignatures = new Set(primary.map(referenceSignature))

  for (const reference of fallback) {
    const signature = referenceSignature(reference)
    if (existingSignatures.has(signature)) {
      continue
    }
    existingSignatures.add(signature)
    merged.push(reference)
  }

  return merged
}

function referenceSignature(reference: ReferenceRecord): string {
  return [
    reference.sourceDocumentId,
    reference.sourceBlockId,
    reference.targetDocumentId,
    reference.targetBlockId,
  ].join('::')
}
