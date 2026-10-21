import type {Finding} from '../../core/contracts';

export type CmsAdapter = {
    id: string;
    name: string;
    category: 'headless' | 'traditional' | 'hybrid';
    status: 'available' | 'port-defined' | 'planned';
    apiStyle: 'rest' | 'graphql' | 'sdk';
    capabilities: ('read' | 'draft' | 'publish' | 'preview' | 'localize')[];
    envVars: string[];
    description: string;
};

export type ChangeProposal = {
    adapterId: string;
    findingId: string;
    title: string;
    instructions: string;     // human-readable implementation steps
    fieldPath?: string;       // CMS field path if deterministic (e.g. 'fields.seoTitle')
    codeSnippet?: string;     // copy-paste implementation hint
    owner: 'content' | 'engineering' | 'seo';
};

export const CMS_ADAPTERS: CmsAdapter[] = [
    {
        id: 'generic',
        name: 'Generic HTML / Static',
        category: 'traditional',
        status: 'available',
        apiStyle: 'rest',
        capabilities: ['read'],
        envVars: [],
        description: 'Any publicly crawlable URL. No authentication required. Read-only evidence collection via HTTP.',
    },
    {
        id: 'contentful',
        name: 'Contentful',
        category: 'headless',
        status: 'available',
        apiStyle: 'rest',
        capabilities: ['read', 'draft'],
        envVars: ['CONTENTFUL_SPACE_ID', 'CONTENTFUL_ACCESS_TOKEN'],
        description: 'Contentful Content Delivery and Management APIs. Read entry fields, stage schema.org updates as drafts.',
    },
    {
        id: 'wordpress',
        name: 'WordPress (REST)',
        category: 'traditional',
        status: 'port-defined',
        apiStyle: 'rest',
        capabilities: ['read', 'draft', 'publish'],
        envVars: ['WP_API_URL', 'WP_APP_PASSWORD'],
        description: 'WordPress REST API (v2). Read posts/pages, update meta fields and Yoast SEO structured data.',
    },
    {
        id: 'aem',
        name: 'Adobe Experience Manager',
        category: 'traditional',
        status: 'port-defined',
        apiStyle: 'rest',
        capabilities: ['read', 'draft'],
        envVars: ['AEM_HOST', 'AEM_TOKEN'],
        description: 'AEM Content Services (Sling Model Exporter). Read page properties and structured content fragments.',
    },
    {
        id: 'strapi',
        name: 'Strapi',
        category: 'headless',
        status: 'port-defined',
        apiStyle: 'rest',
        capabilities: ['read', 'draft', 'publish'],
        envVars: ['STRAPI_URL', 'STRAPI_TOKEN'],
        description: 'Strapi v4 REST / GraphQL API. Full CRUD on content types, supports draft/publish workflow.',
    },
    {
        id: 'drupal',
        name: 'Drupal (JSON:API)',
        category: 'traditional',
        status: 'planned',
        apiStyle: 'rest',
        capabilities: ['read'],
        envVars: ['DRUPAL_URL', 'DRUPAL_TOKEN'],
        description: 'Drupal JSON:API module. Read nodes and taxonomy. Write support planned.',
    },
];

/**
 * Generate deterministic, finding-specific change instructions for a CMS adapter.
 * Pure function — no I/O. Returns a ChangeProposal that can be shown in the UI.
 */
export function generateChangeInstructions(finding: Finding, adapterId: string): ChangeProposal {
    const adapter = CMS_ADAPTERS.find(a => a.id === adapterId);
    const adapterName = adapter?.name ?? adapterId;

    const {dimensionId, title, action, missing} = finding;

    // Determine owner from dimension
    const owner: 'content' | 'engineering' | 'seo' =
        ['schema', 'entities', 'structured-data'].includes(dimensionId) ? 'engineering' :
        ['meta', 'title', 'seo-tags', 'headings'].includes(dimensionId) ? 'seo' :
        'content';

    // Field path heuristic by dimension
    const fieldPathMap: Record<string, string> = {
        'schema':           'fields.structuredData / <script type="application/ld+json">',
        'entities':         'fields.sameAsLinks or custom entity field',
        'freshness':        'fields.updatedAt / sys.updatedAt',
        'author':           'fields.author (Person schema)',
        'meta':             'fields.seoTitle, fields.seoDescription',
        'query':            'fields.body, fields.faqSection',
        'citations':        'fields.citations or fields.references',
        'headings':         'fields.title, fields.headings (H1/H2)',
        'passage':          'fields.body (long-form text)',
    };
    const fieldPath = fieldPathMap[dimensionId];

    // Build instructions
    const missingList = missing.length ? missing.map(m => `  - ${m}`).join('\n') : '  - (see finding evidence)';
    const instructions = [
        `## Fix: ${title}`,
        '',
        `**Platform**: ${adapterName}`,
        `**Dimension**: ${dimensionId}`,
        '',
        '### What to change',
        action,
        '',
        '### Missing items',
        missingList,
        '',
        fieldPath ? `### Field path\n\`${fieldPath}\`` : '',
        '',
        `### Implementation steps (${adapterName})`,
        ...getAdapterSteps(adapterId, dimensionId, adapterName),
    ].filter(l => l !== undefined).join('\n');

    // Code snippet by dimension + adapter
    const codeSnippet = buildCodeSnippet(adapterId, dimensionId, missing);

    return {
        adapterId,
        findingId: finding.id,
        title,
        instructions,
        fieldPath,
        codeSnippet,
        owner,
    };
}

function getAdapterSteps(adapterId: string, dimensionId: string, adapterName: string): string[] {
    const base: Record<string, string[]> = {
        contentful: [
            `1. Open the Contentful web app → Content → find this entry.`,
            `2. Locate the relevant field (see Field path above).`,
            `3. Update the field value with the recommended content.`,
            `4. Click "Save draft" to stage the change.`,
            `5. After review, click "Publish" to deploy.`,
            `6. Re-run a GEO scan to verify the finding is resolved.`,
        ],
        wordpress: [
            `1. Log into WordPress admin → Pages / Posts.`,
            `2. Open the relevant page in the block editor.`,
            `3. Update the Yoast SEO panel or add a Custom HTML block for schema.`,
            `4. Click "Update" to save.`,
            `5. Re-run a GEO scan to verify the finding is resolved.`,
        ],
        aem: [
            `1. Open AEM Author → Sites.`,
            `2. Navigate to the page and open Page Properties.`,
            `3. Update SEO / Social / Schema fields.`,
            `4. Save and create a new version.`,
            `5. Activate the page to publish.`,
            `6. Re-run a GEO scan to verify the finding is resolved.`,
        ],
        strapi: [
            `1. Open Strapi admin → Content Manager.`,
            `2. Find the entry and open the edit view.`,
            `3. Update the relevant field (see Field path above).`,
            `4. Save draft, then click "Publish".`,
            `5. Re-run a GEO scan to verify the finding is resolved.`,
        ],
        generic: [
            `1. Open the page source in your CMS or static site generator.`,
            `2. Apply the recommended change (see "What to change" above).`,
            `3. Deploy the updated page.`,
            `4. Re-run a GEO scan to verify the finding is resolved.`,
        ],
    };
    return base[adapterId] ?? base['generic'];
}

function buildCodeSnippet(adapterId: string, dimensionId: string, missing: string[]): string | undefined {
    if (dimensionId === 'schema' || dimensionId === 'structured-data') {
        return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page title",
  "description": "Page description",
  "dateModified": "${new Date().toISOString().slice(0,10)}"
}
</script>`;
    }
    if (dimensionId === 'entities') {
        return `{
  "@type": "Organization",
  "name": "Brand Name",
  "sameAs": [
    "https://en.wikipedia.org/wiki/Brand_Name",
    "https://www.wikidata.org/wiki/QXXXXXX",
    "https://www.linkedin.com/company/brand-name"
  ]
}`;
    }
    if (dimensionId === 'meta') {
        return `<title>Primary keyword — Brand Name</title>
<meta name="description" content="Concise 150-char description with primary keyword.">`;
    }
    if (dimensionId === 'freshness') {
        return `<meta property="article:modified_time" content="${new Date().toISOString()}">
<!-- or in JSON-LD: "dateModified": "${new Date().toISOString().slice(0,10)}" -->`;
    }
    return undefined;
}
