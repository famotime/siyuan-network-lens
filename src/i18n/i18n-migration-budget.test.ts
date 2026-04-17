import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

describe('i18n migration budget', () => {
  it('keeps direct bilingual helpers and inline locale maps out of production source files', async () => {
    const sourceRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
    const sourceFiles = await collectSourceFiles(sourceRoot)

    for (const filePath of sourceFiles) {
      const relativePath = path.relative(sourceRoot, filePath).replaceAll('\\', '/')
      const source = await readFile(filePath, 'utf8')

      expect(source, `${relativePath} should not use uiText helper`).not.toContain('uiText(')
      expect(source, `${relativePath} should not use pickUiText helper`).not.toContain('pickUiText(')
      expect(source, `${relativePath} should not define inline locale map`).not.toMatch(/\ben_US:\s*['"`]/)
      expect(source, `${relativePath} should not define inline locale map`).not.toMatch(/\bzh_CN:\s*['"`]/)
    }
  })
})

async function collectSourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'i18n') {
        return []
      }
      return collectSourceFiles(fullPath)
    }

    const normalizedPath = fullPath.replaceAll('\\', '/')
    if (!normalizedPath.endsWith('.ts') && !normalizedPath.endsWith('.vue')) {
      return []
    }
    if (normalizedPath.endsWith('.test.ts') || normalizedPath.endsWith('.d.ts')) {
      return []
    }

    return [fullPath]
  }))

  return files.flat()
}
