/** Shared HTML-to-plain-text utility used by scoring and question mapping. */
export function extractText(html: string): string {
    return html
        .replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
