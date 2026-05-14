import { describe, expect, it } from 'vitest'

import {
  filterSelectedValues,
  normalizePathScopeForCommunity,
  resolveCommunitySelectionFromEvidence,
  resolveEvidenceDocumentFromActiveDocument,
  resolvePreferredEvidenceDocument,
  resolveSelectedCommunityId,
  resolveSelectedSummaryCardKey,
  resolveSummaryCardOrderSync,
  resolveSynchronizedPathEndpoints,
} from './use-analytics-selection-sync'

describe('use-analytics-selection-sync helpers', () => {
  it('resets path endpoints when there are no selectable options', () => {
    expect(resolveSynchronizedPathEndpoints({
      options: [],
      currentFromDocumentId: 'doc-a',
      currentToDocumentId: 'doc-b',
    })).toEqual({
      fromDocumentId: '',
      toDocumentId: '',
    })
  })

  it('keeps valid path endpoints and repairs invalid or conflicting targets', () => {
    expect(resolveSynchronizedPathEndpoints({
      options: [{ id: 'doc-a' }, { id: 'doc-b' }, { id: 'doc-c' }],
      currentFromDocumentId: 'doc-a',
      currentToDocumentId: 'doc-c',
    })).toEqual({
      fromDocumentId: 'doc-a',
      toDocumentId: 'doc-c',
    })

    expect(resolveSynchronizedPathEndpoints({
      options: [{ id: 'doc-a' }, { id: 'doc-b' }, { id: 'doc-c' }],
      currentFromDocumentId: 'missing',
      currentToDocumentId: 'doc-a',
    })).toEqual({
      fromDocumentId: 'doc-a',
      toDocumentId: 'doc-b',
    })
  })

  it('selects a preferred evidence document and repairs invalid communities from report changes', () => {
    const report = {
      ranking: [{ documentId: 'doc-rank' }],
      orphans: [{ documentId: 'doc-orphan' }],
      bridgeDocuments: [{ documentId: 'doc-bridge' }],
      communities: [{ id: 'community-a', documentIds: ['doc-rank'] }, { id: 'community-b', documentIds: ['doc-b'] }],
    } as any

    expect(resolvePreferredEvidenceDocument({
      report,
      sampleDocumentIds: new Set(['doc-rank', 'doc-b']),
      currentSelectedEvidenceDocument: 'missing',
    })).toBe('doc-rank')

    expect(resolvePreferredEvidenceDocument({
      report,
      sampleDocumentIds: new Set(['doc-rank', 'doc-b']),
      currentSelectedEvidenceDocument: 'doc-b',
    })).toBe('doc-b')

    expect(resolveSelectedCommunityId(report, 'missing')).toBe('community-a')
    expect(resolveSelectedCommunityId(report, 'community-b')).toBe('community-b')
  })

  it('filters theme or tag selections against the currently allowed values', () => {
    expect(filterSelectedValues(['AI', 'ML', 'Graph'], ['AI', 'Graph'])).toEqual(['AI', 'Graph'])
  })

  it('syncs selected evidence with the active document only when that document is in sample scope', () => {
    expect(resolveEvidenceDocumentFromActiveDocument({
      activeDocumentId: 'doc-a',
      sampleDocumentIds: new Set(['doc-a', 'doc-b']),
      currentSelectedEvidenceDocument: 'doc-b',
    })).toBe('doc-a')

    expect(resolveEvidenceDocumentFromActiveDocument({
      activeDocumentId: 'doc-x',
      sampleDocumentIds: new Set(['doc-a', 'doc-b']),
      currentSelectedEvidenceDocument: 'doc-b',
    })).toBe('doc-b')

    expect(resolveEvidenceDocumentFromActiveDocument({
      activeDocumentId: 'doc-x',
      sampleDocumentIds: new Set(['doc-a', 'doc-b']),
      currentSelectedEvidenceDocument: 'missing',
    })).toBe('')
  })

  it('derives the selected community from the chosen evidence document and normalizes path scope', () => {
    const report = {
      communities: [
        { id: 'community-a', documentIds: ['doc-a', 'doc-b'] },
        { id: 'community-b', documentIds: ['doc-c'] },
      ],
    } as any

    expect(resolveCommunitySelectionFromEvidence({
      report,
      selectedEvidenceDocument: 'doc-b',
      currentSelectedCommunityId: 'community-b',
    })).toBe('community-a')

    expect(resolveCommunitySelectionFromEvidence({
      report,
      selectedEvidenceDocument: '',
      currentSelectedCommunityId: 'community-b',
    })).toBe('community-b')

    expect(normalizePathScopeForCommunity('community', false)).toBe('focused')
    expect(normalizePathScopeForCommunity('community', true)).toBe('community')
  })

  it('repairs selected summary card key and persisted summary card order only when needed', () => {
    expect(resolveSelectedSummaryCardKey({
      cards: [{ key: 'documents' }, { key: 'ranking' }] as any,
      currentSelectedSummaryCardKey: 'orphans' as any,
    })).toBe('documents')

    expect(resolveSelectedSummaryCardKey({
      cards: [{ key: 'documents' }, { key: 'ranking' }] as any,
      currentSelectedSummaryCardKey: 'ranking' as any,
    })).toBe('ranking')

    expect(resolveSummaryCardOrderSync({
      savedOrder: ['documents', 'ranking'],
      currentOrder: ['documents', 'ranking'],
    })).toBeNull()

    expect(resolveSummaryCardOrderSync({
      savedOrder: ['ranking', 'documents'],
      currentOrder: ['documents', 'ranking'],
    })?.slice(0, 2)).toEqual(['ranking', 'documents'])
  })
})
