import { env } from 'cloudflare:workers';
import type { Client, Repository } from '../core/contracts';
export class D1Repository implements Repository {
    private db() { if (!env.DB)
        throw new Error('Storage unavailable'); return env.DB; }
    async listClients(owner: string) { const r = await this.db().prepare('SELECT data FROM clients WHERE owner = ? ORDER BY created DESC LIMIT 100').bind(owner).all<{
        data: string;
    }>(); return r.results.map(r => JSON.parse(r.data) as Client); }
    async getClient(owner: string, id: string) { const r = await this.db().prepare('SELECT data FROM clients WHERE owner = ? AND id = ?').bind(owner, id).first<{
        data: string;
    }>(); return r ? JSON.parse(r.data) as Client : null; }
    async saveClient(owner: string, c: Client) { await this.db().prepare('INSERT INTO clients (id,owner,data,created) VALUES (?,?,?,?)').bind(c.id, owner, JSON.stringify(c), c.created).run(); }
    async listRecords<T>(owner: string, clientId: string, kind: 'audit' | 'observation') { const r = await this.db().prepare('SELECT data FROM records WHERE owner = ? AND client_id = ? AND kind = ? ORDER BY created DESC LIMIT 200').bind(owner, clientId, kind).all<{
        data: string;
    }>(); return r.results.map(r => JSON.parse(r.data) as T); }
    async saveRecords(owner: string, clientId: string, kind: 'audit' | 'observation', rows: {
        id: string;
        created: string;
    }[]) { await this.db().batch(rows.map(r => this.db().prepare('INSERT INTO records (id,owner,client_id,kind,data,created) VALUES (?,?,?,?,?,?)').bind(r.id, owner, clientId, kind, JSON.stringify(r), r.created))); }
}
