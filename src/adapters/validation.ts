import { z } from 'zod';
export const urlSchema = z.string().url().max(2048).refine(s => { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; }, 'Use an HTTP(S) URL without credentials');
export const clientSchema = z.object({ name: z.string().trim().min(2).max(100), domain: urlSchema, industry: z.string().trim().min(2).max(120), market: z.string().trim().min(2).max(100), products: z.array(z.string().trim().min(1).max(120)).max(10), competitors: z.array(z.string().trim().min(1).max(100)).max(5) }).strict();
export const auditSchema = z.object({ url: urlSchema, html: z.string().min(20).max(250000) }).strict();
export const observationSchema = z.array(z.object({ engine: z.string().trim().min(1).max(60), surface: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100), prompt: z.string().trim().min(5).max(2000), response: z.string().trim().min(1).max(12000), citations: z.array(urlSchema).max(30), observedAt: z.string().datetime().refine(s => new Date(s).getTime() <= Date.now(), 'Observation date cannot be in the future') }).strict()).min(1).max(20);

export const identitySchema = z.object({name: z.string().trim().min(2).max(100), brandAliases: z.array(z.string().trim().min(2).max(100)).max(10)}).strict();
export const scanSchema = z.object({url: urlSchema, clientId: z.string().uuid().optional()}).strict();

export const probeSchema = z.object({
    clientId: z.string().uuid(),
    prompts: z.array(z.string().trim().min(5).max(2000)).min(1).max(30),
    providers: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
}).strict();

export const competitorScanSchema = z.object({
    competitorUrls: z.array(urlSchema).min(1).max(5),
    clientId: z.string().uuid().optional(),
}).strict();

export const benchmarkSchema = z.object({
    urls: z.array(urlSchema).min(2).max(6),
    labels: z.array(z.string().trim().min(1).max(80)).min(2).max(6).optional(),
}).strict();

export const smartPromptsSchema = z.object({
    clientId: z.string().uuid(),
    provider: z.string().min(1).max(60),
    auditId: z.string().optional(),
}).strict();

export const customPromptsSchema = z.array(z.string().trim().min(5).max(2000)).max(50);

export const contentfulFetchSchema = z.object({
    entryId: z.string().trim().min(1).max(200),
    clientId: z.string().uuid().optional(),
    spaceId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const scheduleSchema = z.object({
    clientId: z.string().uuid(),
    cadence: z.enum(['daily','weekly','monthly']),
    providers: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
    prompts: z.array(z.string().trim().min(5).max(2000)).min(1).max(20),
    enabled: z.boolean().optional(),
}).strict();

export const alertSchema = z.object({
    clientId: z.string().uuid(),
    metric: z.enum(['mentionRate','citationRate','score']),
    threshold: z.number().min(0).max(100),
    direction: z.enum(['below','above']),
    enabled: z.boolean().optional(),
}).strict();

export const findingPatchSchema = z.object({
    status: z.enum(['open','approved','rejected','implemented','resolved']).optional(),
    owner: z.string().trim().min(1).max(100).optional(),
}).strict();

export const recommendationPatchSchema = z.object({
    status: z.enum(['draft','approved','rejected','implemented']).optional(),
    reviewNote: z.string().trim().max(1000).optional(),
    owner: z.string().trim().min(1).max(100).optional(),
    effort: z.enum(['low','medium','high']).optional(),
    impact: z.enum(['low','medium','high']).optional(),
}).strict();
