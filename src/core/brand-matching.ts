import type {Client} from './contracts';

/** Explicit identity variants only; do not guess aliases or strip all spaces. */
export function mentionsBrand(client: Client, text: string): boolean {
    const variants = [client.name, ...client.brandAliases || []].map(v => v.trim()).filter(Boolean);
    return variants.some(v => {
        const escaped = v.split(/\s+/).map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
        return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
    });
}
