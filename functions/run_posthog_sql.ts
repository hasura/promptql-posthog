import * as sdk from '@hasura/ndc-lambda-sdk';

/**
 * @readonly
 * Executes a SQL query against PostHog using the HogQL Query API
 * @param sql - The SQL query to execute (HogQL syntax -- which is effectively a wrapper on ClickHouse SQL)
 * @return Query results including columns and stringified rows
 *
 * Required environment variables:
 * - POSTHOG_API_KEY: PostHog API key for authentication
 * - POSTHOG_PROJECT_ID: PostHog project ID
 * - POSTHOG_HOST: PostHog API host (optional, defaults to us.posthog.com)
 */
export async function run_posthog_sql(
  sql: string
): Promise<PostHogQueryResponse> {
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
    const url = `https://${HOST}/api/projects/${PROJECT_ID}/query`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: sql
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as PostHogAPIResponse;

    const stringifiedResults = (data.results ?? []).map(row => JSON.stringify(row));

    return {
      columns: data.columns ?? [],
      results: stringifiedResults,
      hasMore: data.hasMore ?? false,
      limit: data.limit ?? null,
      offset: data.offset ?? null,
      isCached: data.is_cached ?? false,
      executionTime: data.timings?.find(t => t.k === 'query')?.t ?? null
    };
  } catch (error) {
    throw new sdk.UnprocessableContent(
      "PostHog query failed: " + (error instanceof Error ? error.message : JSON.stringify(error))
    );
  }
}

// Type definitions
export interface PostHogQueryResponse {
  columns: string[];
  results: string[];
  hasMore: boolean;
  limit: number | null;
  offset: number | null;
  isCached: boolean;
  executionTime: number | null;
}

interface PostHogAPIResponse {
  columns?: string[];
  results?: any[][];
  hasMore?: boolean;
  limit?: number;
  offset?: number;
  is_cached?: boolean;
  timings?: Array<{ k: string; t: number }>;
}
