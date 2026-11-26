// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { showInvisible } from '@/components/workspace/visibleText'

describe('showInvisible', () => {
    it('shows spaces, tabs and line breaks', () => {
        expect(showInvisible('  asha ')).toBe('··asha·')
        expect(showInvisible('a\tb')).toBe('a→b')
    })

    it.each(['a\nb', 'a\r\nb', 'a\rb', 'a\u2028b', 'a\u2029b'])(
        'shows %j as one line break',
        (text) => {
            expect(showInvisible(text)).toBe('a↵b')
        },
    )

    it('keeps two line breaks as two', () => {
        expect(showInvisible('a\r\n\r\nb')).toBe('a↵↵b')
        expect(showInvisible('a\n\nb')).toBe('a↵↵b')
    })

    it.each([
        ['a\u00A0b', 'a[U+00A0]b'],
        ['a\u200Bb', 'a[U+200B]b'],
        ['a\u0000b', 'a[U+0000]b'],
        ['a\u0085b', 'a[U+0085]b'],
        ['a\u007Fb', 'a[U+007F]b'],
        ['a\uFEFFb', 'a[U+FEFF]b'],
        ['a\u00ADb', 'a[U+00AD]b'],
        ['a\u2060b', 'a[U+2060]b'],
        ['a\u200Db', 'a[U+200D]b'],
        ['a\u200Eb', 'a[U+200E]b'],
        ['a\u3000b', 'a[U+3000]b'],
    ])('shows %j as its code', (text, expected) => {
        expect(showInvisible(text)).toBe(expected)
    })

    it('leaves visible text alone, including other scripts and emoji', () => {
        for (const text of ['Asha Singh'.replace(' ', ''), 'नमस्ते', 'क\u094Dष', 'a😀b', 'straße']) {
            expect(showInvisible(text)).toBe(text)
        }
    })

    it('handles empty text and mixed text', () => {
        expect(showInvisible('')).toBe('')
        expect(showInvisible(' \u200Ba\tb\n')).toBe('·[U+200B]a→b↵')
    })
})