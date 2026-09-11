import { describe, it, expect } from 'vitest'
import { extractRefLinks, resolveRefLinks, parseExistingId } from '../../server/utils/importRefs'

describe('import ref links ({{ref:...}} in descriptions)', () => {
  it('extracts payload and existing refs in order', () => {
    expect(extractRefLinks('Lives in {{ref:loc:1}}, knows {{ref: existing:12 }} and {{ref:loc:1}}'))
      .toEqual(['loc:1', 'existing:12', 'loc:1'])
    expect(extractRefLinks('')).toEqual([])
    expect(extractRefLinks(null)).toEqual([])
    // real links are not refs
    expect(extractRefLinks('already {{npc:5}}')).toEqual([])
  })

  it('resolves refs to real links and leaves unknown ones untouched', () => {
    const ids: Record<string, string> = { 'npc:1': '{{npc:100}}', 'existing:12': '{{location:12}}' }
    const out = resolveRefLinks('A {{ref:npc:1}} in {{ref:existing:12}} – {{ref:npc:9}}', ref => ids[ref] ?? null)
    expect(out).toBe('A {{npc:100}} in {{location:12}} – {{ref:npc:9}}')
  })

  it('is reusable across calls (global regex state must not leak)', () => {
    const text = '{{ref:a}} {{ref:b}}'
    expect(extractRefLinks(text)).toEqual(['a', 'b'])
    expect(extractRefLinks(text)).toEqual(['a', 'b'])
    expect(resolveRefLinks(text, r => `<${r}>`)).toBe('<a> <b>')
    expect(resolveRefLinks(text, r => `<${r}>`)).toBe('<a> <b>')
  })

  it('parseExistingId only accepts the existing:<id> form', () => {
    expect(parseExistingId('existing:12')).toBe(12)
    expect(parseExistingId('npc:1')).toBeNull()
    expect(parseExistingId(undefined)).toBeNull()
  })
})
