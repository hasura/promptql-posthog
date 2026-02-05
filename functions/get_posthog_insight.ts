import * as sdk from '@hasura/ndc-lambda-sdk';

/**
 * @readonly
 * Retrieves detailed information about a specific PostHog insight including its full query definition.
 * Use this to understand the exact analytics question being asked, including events, properties, and filters.
 * @param insightId - The numeric ID of the insight to retrieve
 * @return Detailed insight data including query definition, filters, and dashboard associations
 *
 * Required environment variables:
 * - POSTHOG_API_KEY: PostHog API key for authentication
 * - POSTHOG_PROJECT_ID: PostHog project ID
 * - POSTHOG_HOST: PostHog API host (optional, defaults to us.posthog.com)
 */
export async function get_posthog_insight(
  insightId: number
): Promise<InsightDetailResponse> {
  const API_KEY = process.env.POSTHOG_API_KEY;
  const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
  const HOST = process.env.POSTHOG_HOST || 'us.posthog.com';

  if (!API_KEY) {
    throw new sdk.UnprocessableContent("POSTHOG_API_KEY environment variable is required");
  }

  if (!PROJECT_ID) {
    throw new sdk.UnprocessableContent("POSTHOG_PROJECT_ID environment variable is required");
  }

  try {
    const url = `https://${HOST}/api/projects/${PROJECT_ID}/insights/${insightId}/`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as PostHogInsightResponse;

    return {
      id: data.id,
      shortId: data.short_id ?? null,
      name: data.name ?? data.derived_name ?? null,
      derivedName: data.derived_name ?? null,
      description: data.description ?? null,
      tags: data.tags ?? [],
      favorited: data.favorited ?? false,
      lastRefresh: data.last_refresh ?? null,
      lastModifiedAt: data.last_modified_at ?? null,
      createdAt: data.created_at ?? null,
      createdBy: data.created_by?.email ?? data.created_by?.first_name ?? null,
      // Query definition - stringified for flexibility
      query: data.query ? JSON.stringify(data.query) : null,
      // Legacy filters - stringified for flexibility
      filters: data.filters ? JSON.stringify(data.filters) : null,
      // HogQL representation if available
      hogql: data.hogql ?? null,
      // Dashboard associations
      dashboards: (data.dashboards ?? []).map(d => ({
        id: typeof d === 'number' ? d : d.id,
        name: typeof d === 'number' ? null : (d.name ?? null)
      })),
      // Query metadata
      queryKind: extractQueryKind(data.query),
      // Events being tracked (extracted from query/filters)
      trackedEvents: extractTrackedEvents(data.query, data.filters)
    };
  } catch (error) {
    throw new sdk.UnprocessableContent(
      "Failed to get insight: " + (error instanceof Error ? error.message : JSON.stringify(error))
    );
  }
}

// Helper to extract query kind (TrendsQuery, FunnelsQuery, etc.)
function extractQueryKind(query: any): string | null {
  if (!query) return null;
  if (typeof query === 'object' && 'kind' in query) {
    return query.kind;
  }
  return null;
}

// Helper to extract tracked events from query or filters
function extractTrackedEvents(query: any, filters: any): string[] {
  const events = new Set<string>();

  // Extract from new query format
  if (query) {
    // TrendsQuery, FunnelsQuery series
    if (query.series && Array.isArray(query.series)) {
      for (const series of query.series) {
        if (series.event) events.add(series.event);
        if (series.name) events.add(series.name);
      }
    }
    // HogQLQuery
    if (query.query && typeof query.query === 'string') {
      // Try to extract event names from HogQL (basic extraction)
      const eventMatches = query.query.match(/event\s*=\s*'([^']+)'/gi);
      if (eventMatches) {
        for (const match of eventMatches) {
          const eventName = match.match(/'([^']+)'/)?.[1];
          if (eventName) events.add(eventName);
        }
      }
    }
  }

  // Extract from legacy filters format
  if (filters) {
    if (filters.events && Array.isArray(filters.events)) {
      for (const event of filters.events) {
        if (event.id) events.add(event.id);
        if (event.name) events.add(event.name);
      }
    }
    if (filters.actions && Array.isArray(filters.actions)) {
      for (const action of filters.actions) {
        if (action.name) events.add(action.name);
      }
    }
  }

  return Array.from(events);
}

// Response types
export interface InsightDetailResponse {
  id: number;
  shortId: string | null;
  name: string | null;
  derivedName: string | null;
  description: string | null;
  tags: string[];
  favorited: boolean;
  lastRefresh: string | null;
  lastModifiedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
  query: string | null;
  filters: string | null;
  hogql: string | null;
  dashboards: DashboardReference[];
  queryKind: string | null;
  trackedEvents: string[];
}

export interface DashboardReference {
  id: number;
  name: string | null;
}

// PostHog API response types
interface PostHogInsightResponse {
  id: number;
  short_id?: string;
  name?: string;
  derived_name?: string;
  description?: string;
  tags?: string[];
  favorited?: boolean;
  last_refresh?: string;
  last_modified_at?: string;
  created_at?: string;
  created_by?: {
    id?: number;
    email?: string;
    first_name?: string;
  };
  query?: any;
  filters?: any;
  hogql?: string;
  dashboards?: Array<number | { id: number; name?: string }>;
}
