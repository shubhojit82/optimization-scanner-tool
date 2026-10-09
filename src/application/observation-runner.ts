import type {AIProvider, Observation, ObservationLookup, Repository} from '../core/contracts';
import {CollectionError} from '../core/contracts';

/** One query per request. Queued campaigns can call this same provider port later. */
export class ObservationRunner {
    private active = new Set<string>();
    constructor(private repo: Repository & ObservationLookup, private providers: Map<string, AIProvider>) {}

    async run(owner: string, clientId: string, providerId: string, prompt: string, requestId: string) {
        const client = await this.repo.getClient(owner, clientId);
        if (!client) throw new Error('Client not found');
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([owner, clientId, requestId])));
        const id = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
        const saved = await this.repo.findObservation(owner, clientId, id);
        if (saved) {
            if (saved.prompt !== prompt || saved.engine !== providerId) throw new CollectionError('Request ID was already used for another query.', 409);
            return saved;
        }
        const provider = this.providers.get(providerId);
        if (!provider) throw new CollectionError('Provider is not configured. Add OPENAI_API_KEY to your server .env file and restart.', 503);
        if (this.active.has(id)) throw new CollectionError('This query is already running. Wait for its result.', 409);
        if (this.active.size >= 2) throw new CollectionError('Two queries are already running. Try again after one finishes.', 429);
        this.active.add(id);
        try {
            const evidence = await provider.observe(prompt, client.market);
            const observation: Observation = {...evidence, id, clientId, created: new Date().toISOString(), source: 'ai-provider'};
            await this.repo.saveRecords(owner, clientId, 'observation', [observation]);
            return observation;
        } finally { this.active.delete(id); }
    }
}
