import * as sdk from '@hasura/ndc-lambda-sdk';

/**
 * @readonly
 * Lists all dashboards in the PostHog project with their metadata and embedded insights summary.
 * Useful for discovering what analytics problems/topics are being tracked in the account.
 * @return List of dashboards with metadata, timestamps, and insight summaries
 *
 * Required environment variables:
 * - POSTHOG_API_KEY: PostHog API key for authentication
 * - POSTHOG_PROJECT_ID: PostHog project ID
 * - POSTHOG_HOST: PostHog API host (optional, defaults to us.posthog.com)
 */
export async function list_posthog_dashboards(): Promise<ListDashboardsResponse> {
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
    const allDashboards: DashboardSummary[] = [];
    let nextUrl: string | null = `https://${HOST}/api/projects/${PROJECT_ID}/dashboards/`;

    // Paginate through all dashboards
    while (nextUrl) {
      const response = await fetch(nextUrl, {
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

      const data = await response.json() as PostHogDashboardListResponse;

      for (const dashboard of data.results ?? []) {
        // Extract insight summaries from tiles
        const insights: InsightSummary[] = (dashboard.tiles ?? [])
          .filter(tile => tile.insight != null)
          .map(tile => ({
            id: tile.insight!.id,
            shortId: tile.insight!.short_id ?? null,
            name: tile.insight!.name ?? tile.insight!.derived_name ?? null,
            description: tile.insight!.description ?? null
          }));

        allDashboards.push({
          id: dashboard.id,
          name: dashboard.name ?? null,
          description: dashboard.description ?? null,
          tags: dashboard.tags ?? [],
          pinned: dashboard.pinned ?? false,
          createdAt: dashboard.created_at ?? null,
          createdBy: dashboard.created_by?.email ?? dashboard.created_by?.first_name ?? null,
          lastAccessedAt: dashboard.last_accessed_at ?? null,
          insightCount: insights.length,
          insights: insights
        });
      }

      nextUrl = data.next ?? null;
    }

    return {
      dashboards: allDashboards,
      totalCount: allDashboards.length
    };
  } catch (error) {
    throw new sdk.UnprocessableContent(
      "Failed to list dashboards: " + (error instanceof Error ? error.message : JSON.stringify(error))
    );
  }
}

// Response types
export interface ListDashboardsResponse {
  dashboards: DashboardSummary[];
  totalCount: number;
}

export interface DashboardSummary {
  id: number;
  name: string | null;
  description: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: string | null;
  createdBy: string | null;
  lastAccessedAt: string | null;
  insightCount: number;
  insights: InsightSummary[];
}

export interface InsightSummary {
  id: number;
  shortId: string | null;
  name: string | null;
  description: string | null;
}

// PostHog API response types
interface PostHogDashboardListResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: PostHogDashboard[];
}

interface PostHogDashboard {
  id: number;
  name?: string;
  description?: string;
  tags?: string[];
  pinned?: boolean;
  created_at?: string;
  created_by?: {
    id?: number;
    email?: string;
    first_name?: string;
  };
  last_accessed_at?: string;
  tiles?: PostHogTile[];
}

interface PostHogTile {
  id?: number;
  insight?: {
    id: number;
    short_id?: string;
    name?: string;
    derived_name?: string;
    description?: string;
  };
}
