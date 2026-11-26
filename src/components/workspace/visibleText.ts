// Characters that cannot be seen: control characters, invisible formatting
// characters (zero-width space and joiners, the soft hyphen, the byte order
// mark, direction marks) and spaces other than the ordinary one (such as the
// non-breaking space).
const INVISIBLE = /^[\p{Cc}\p{Cf}\p{Zs}]$/u

function code(character: string): string {
    const point = character.codePointAt(0) ?? 0
    return `[U+${point.toString(16).toUpperCase().padStart(4, '0')}]`
}

/**
 * Makes hidden characters visible, so a change such as "Asha " to "Asha" can
 * be seen. Spaces show as ·, tabs as →, line breaks as ↵, and any other
 * invisible character as its code, for example [U+200B]. Display only: it
 * never changes data.
 */
export function showInvisible(text: string): string {
    const characters = Array.from(text)
    const out: string[] = []
    for (let i = 0; i < characters.length; i += 1) {
        const character = characters[i]
        if (character === undefined) continue
        if (character === '\r') {
            out.push('↵')
            // A Windows line break is two characters but one break.
            if (characters[i + 1] === '\n') i += 1
        } else if (character === '\n' || character === '\u2028' || character === '\u2029') {
            out.push('↵')
        } else if (character === ' ') {
            out.push('·')
        } else if (character === '\t') {
            out.push('→')
        } else if (INVISIBLE.test(character)) {
            out.push(code(character))
        } else {
            out.push(character)
        }
    }
    return out.join('')
}