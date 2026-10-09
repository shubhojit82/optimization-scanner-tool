import type {ClientIdentity, ClientIdentityStore, Repository} from '../core/contracts';

export class ClientIdentityService {
    constructor(private repo: Repository & ClientIdentityStore) {}
    async update(owner: string, clientId: string, input: ClientIdentity) {
        if (!await this.repo.getClient(owner, clientId)) throw new Error('Client not found');
        const name = input.name.trim();
        const seen = new Set([name.toLocaleLowerCase('en-US')]);
        const brandAliases = input.brandAliases.map(s => s.trim()).filter(s => {
            const key = s.toLocaleLowerCase('en-US');
            if (!s || seen.has(key)) return false;
            seen.add(key); return true;
        });
        const saved = await this.repo.updateIdentity(owner, clientId, {name, brandAliases}, new Date().toISOString());
        if (!saved) throw new Error('Client not found');
        return saved;
    }
}
