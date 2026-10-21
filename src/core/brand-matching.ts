import type {Client} from './contracts';

/**
 * Returns true if any brand variant (name or alias) is mentioned in text.
 *
 * Matching strategy (in order):
 * 1. Exact word-boundary match on the stored variant (handles "World Financial Group")
 * 2. Collapsed match — strips all whitespace/hyphens from both variant and text,
 *    so "WorldFinancialgroup" matches "World Financial Group" and vice-versa.
 *    Only applied when the collapsed form is >= 4 chars to avoid false positives.
 */
export function mentionsBrand(client: Client, text: string): boolean {
    const variants = [client.name, ...(client.brandAliases ?? [])].map(v => v.trim()).filter(Boolean);
    return variants.some(v => matchesVariant(v, text));
}

function matchesVariant(variant: string, text: string): boolean {
    // 1. Exact boundary match (tokens joined by flexible whitespace)
    const escaped = variant
        .split(/\s+/)
        .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[\\s\\-]*');
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text)) return true;

    // 2. Run-together match — allows optional spaces/hyphens/underscores between any two characters,
    //    but keeps word boundaries at both ends so "World Financial Grouper" or "Northstarlight" do not match.
    //    Handles "WorldFinancialgroup" ↔ "World Financial Group" ↔ "world-financial-group"
    const chars = [...variant.replace(/[\s\-_]+/g, '')];
    if (chars.length < 4) return false;  // too short to be meaningful
    const body = chars.map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-_]*');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${body}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

/** Derive the most likely canonical display form of a brand name.
 *  "WorldFinancialgroup" → "World Financial Group" (splits on camelCase boundaries).
 *  Used for display only, not for matching.
 */
export function canonicalBrandName(name: string): string {
    // Already has spaces → return as-is
    if (/\s/.test(name)) return name;
    // Split camelCase: "WorldFinancialGroup" → "World Financial Group"
    return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}
