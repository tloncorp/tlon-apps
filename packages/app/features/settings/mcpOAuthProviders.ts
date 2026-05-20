export type McpOAuthProviderKind = 'standard' | 'mcp_remote';

export type McpOAuthUpstream =
  | {
      mode: 'proxy';
      name: string;
      url: string;
    }
  | {
      mode: 'openapi';
      name: string;
      schemaUrl: string;
    };

export interface McpOAuthProvider {
  authUrl?: string;
  displayName: string;
  id: string;
  kind: McpOAuthProviderKind;
  revokeUrl?: string;
  scopes: string;
  suggestedUpstream: McpOAuthUpstream;
  template: string;
  tokenUrl?: string;
}

export const MCP_OAUTH_PROVIDERS: McpOAuthProvider[] = [
  {
    authUrl: 'https://airtable.com/oauth2/v1/authorize',
    displayName: 'Airtable',
    id: 'airtable',
    kind: 'standard',
    scopes:
      'data.records:read data.records:write schema.bases:read workspacesAndBases:read data.recordComments:read data.recordComments:write',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Airtable',
      url: 'https://mcp.airtable.com/mcp',
    },
    template: 'Airtable',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
  },
  {
    authUrl: 'https://dev.are.na/oauth/authorize',
    displayName: 'Are.na',
    id: 'arena',
    kind: 'standard',
    scopes: '',
    suggestedUpstream: {
      mode: 'openapi',
      name: 'Are.na',
      schemaUrl:
        'https://raw.githubusercontent.com/aredotna/mcp/refs/heads/main/src/generated/openapi.json',
    },
    template: 'Are.na',
    tokenUrl: 'https://dev.are.na/oauth/token',
  },
  {
    displayName: 'Atlassian',
    id: 'atlassian',
    kind: 'mcp_remote',
    scopes:
      'read:me read:account offline_access read:jira-work write:jira-work search:confluence read:page:confluence write:page:confluence read:comment:confluence write:comment:confluence read:space:confluence read:hierarchical-content:confluence read:confluence-user',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Atlassian',
      url: 'https://mcp.atlassian.com/v1/mcp/authv2',
    },
    template: 'MCP Remote',
  },
  {
    authUrl: 'https://github.com/login/oauth/authorize',
    displayName: 'GitHub',
    id: 'github',
    kind: 'standard',
    scopes: 'read:user user:email repo',
    suggestedUpstream: {
      mode: 'openapi',
      name: 'GitHub',
      schemaUrl:
        'https://storage.googleapis.com/tlon-test-bots/github-repos-only.json',
    },
    template: 'GitHub',
    tokenUrl: 'https://github.com/login/oauth/access_token',
  },
  {
    displayName: 'Linear',
    id: 'linear',
    kind: 'mcp_remote',
    scopes: '',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Linear',
      url: 'https://mcp.linear.app/mcp',
    },
    template: 'MCP Remote',
  },
  {
    authUrl: 'https://mcp.notion.com/authorize',
    displayName: 'Notion',
    id: 'notion',
    kind: 'mcp_remote',
    revokeUrl: 'https://mcp.notion.com/token',
    scopes: '',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Notion',
      url: 'https://mcp.notion.com/mcp',
    },
    template: 'MCP Remote',
    tokenUrl: 'https://mcp.notion.com/token',
  },
  {
    authUrl: 'https://oauth.posthog.com/oauth/authorize/',
    displayName: 'PostHog',
    id: 'posthog',
    kind: 'mcp_remote',
    revokeUrl: 'https://oauth.posthog.com/oauth/revoke/',
    scopes:
      'openid profile email user:read project:read insight:read insight:write dashboard:read dashboard:write feature_flag:read feature_flag:write query:read web_analytics:read llm_analytics:read llm_analytics:write',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'PostHog',
      url: 'https://mcp.posthog.com/mcp',
    },
    template: 'MCP Remote',
    tokenUrl: 'https://oauth.posthog.com/oauth/token/',
  },
  {
    displayName: 'Ref',
    id: 'ref',
    kind: 'mcp_remote',
    scopes: 'public_docs:read private_docs:read',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Ref',
      url: 'https://api.ref.tools/mcp',
    },
    template: 'MCP Remote',
  },
  {
    displayName: 'Sentry',
    id: 'sentry',
    kind: 'mcp_remote',
    scopes: 'org:read project:write team:write event:write',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Sentry',
      url: 'https://mcp.sentry.dev/mcp',
    },
    template: 'MCP Remote',
  },
  {
    displayName: 'Supabase',
    id: 'supabase',
    kind: 'mcp_remote',
    scopes:
      'organizations:read projects:read projects:write database:read database:write analytics:read secrets:read edge_functions:read edge_functions:write environment:read environment:write storage:read',
    suggestedUpstream: {
      mode: 'proxy',
      name: 'Supabase',
      url: 'https://mcp.supabase.com/mcp',
    },
    template: 'MCP Remote',
  },
];
