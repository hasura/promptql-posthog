# PostHog Connector for Hasura DDN

A Hasura NDC (Native Data Connector) that enables querying PostHog analytics. Execute HogQL queries, discover dashboards, and retrieve insight definitions.

## Features

- Execute HogQL queries (ClickHouse SQL dialect) against your PostHog data
- List all dashboards with metadata (timestamps, pinned status, insight summaries)
- Retrieve detailed insight definitions including query/filter configurations
- Ideal for AI agents to discover analytics topics and problems in an account

## Supported Functions

### `run_posthog_sql(sql: string)`

Executes a HogQL query against PostHog.

**Parameters:**
- `sql` - The HogQL query to execute

**Returns:**
- `columns` - Array of column names
- `results` - Array of stringified row data
- `hasMore` - Whether more results are available
- `limit` - Query result limit
- `offset` - Query result offset
- `isCached` - Whether results came from cache
- `executionTime` - Query execution time in seconds

### `list_posthog_dashboards()`

Lists all dashboards in the project with metadata and insight summaries.

**Returns:**
- `dashboards` - Array of dashboard objects:
  - `id` - Dashboard ID
  - `name` - Dashboard name
  - `description` - Dashboard description
  - `tags` - Array of tags
  - `pinned` - Whether dashboard is pinned
  - `createdAt` - Creation timestamp
  - `createdBy` - Creator email/name
  - `lastAccessedAt` - Last access timestamp (useful for finding active dashboards)
  - `insightCount` - Number of insights in dashboard
  - `insights` - Array of insight summaries (id, shortId, name, description)
- `totalCount` - Total number of dashboards

### `get_posthog_insight(insightId: number)`

Retrieves detailed information about a specific insight including its full query definition.

**Parameters:**
- `insightId` - The numeric ID of the insight

**Returns:**
- `id` - Insight ID
- `shortId` - Short ID for URLs
- `name` - Insight name
- `derivedName` - Auto-generated name if no custom name set
- `description` - Insight description
- `tags` - Array of tags
- `favorited` - Whether insight is favorited
- `lastRefresh` - Last data refresh timestamp
- `lastModifiedAt` - Last modification timestamp
- `createdAt` - Creation timestamp
- `createdBy` - Creator email/name
- `query` - Full query definition (JSON string)
- `filters` - Legacy filters (JSON string)
- `hogql` - HogQL representation if available
- `dashboards` - Array of dashboard references (id, name)
- `queryKind` - Type of query (TrendsQuery, FunnelsQuery, etc.)
- `trackedEvents` - Array of event names being tracked

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `POSTHOG_API_KEY` | Yes | PostHog API key for authentication. Get from PostHog Settings > Project > Personal API Keys | - |
| `POSTHOG_PROJECT_ID` | Yes | PostHog project ID. Found in PostHog URL: `app.posthog.com/project/{PROJECT_ID}` | - |
| `POSTHOG_HOST` | No | PostHog API host URL | `us.posthog.com` |

## HogQL Query Examples

### Count events by type
```sql
SELECT event, count() as count
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY event
ORDER BY count DESC
LIMIT 10
```

### Get unique users per day
```sql
SELECT
  toDate(timestamp) as date,
  uniq(distinct_id) as unique_users
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date
```

### Page view funnel
```sql
SELECT
  event,
  count() as count
FROM events
WHERE event IN ('$pageview', 'sign_up', 'purchase')
  AND timestamp > now() - INTERVAL 7 DAY
GROUP BY event
```

### User properties
```sql
SELECT
  properties.$browser as browser,
  count() as count
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY browser
ORDER BY count DESC
```

## Setup

### Using Hasura DDN CLI

1. Add the connector to your project:
   ```bash
   ddn connector add posthog --hub hasura/posthog
   ```

2. Set environment variables in your `.env` file:
   ```
   POSTHOG_API_KEY=phx_your_api_key
   POSTHOG_PROJECT_ID=12345
   ```

3. Update your Hasura metadata and deploy.

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your PostHog credentials:
   ```
   POSTHOG_API_KEY=phx_your_api_key
   POSTHOG_PROJECT_ID=12345
   POSTHOG_HOST=us.posthog.com
   ```

3. Run the connector:
   ```bash
   npm start
   ```

### Docker

Build and run with Docker:

```bash
docker build -f .hasura-connector/Dockerfile -t posthog-connector .

docker run -p 8080:8080 \
  -e POSTHOG_API_KEY=phx_your_api_key \
  -e POSTHOG_PROJECT_ID=12345 \
  posthog-connector
```

## PromptQL Workflow

This connector is designed to help PromptQL understand what analytics problems are being tracked in a PostHog account:

1. **Discover dashboards**: Call `listPosthogDashboards()` to get all dashboards with timestamps
2. **Prioritize**: Use `lastAccessedAt` and `pinned` to identify the most important/active dashboards
3. **Understand insights**: For interesting insights, call `getPosthogInsight(id)` to get full query details
4. **Analyze**: Use dashboard names, descriptions, insight names, and tracked events to identify analytics themes

Example prompt for AI: *"Find top 20 analytics problems/topics for this account by analyzing dashboard and insight metadata"*

## PostHog Host URLs

| Region | Host |
|--------|------|
| US Cloud | `us.posthog.com` |
| EU Cloud | `eu.posthog.com` |
| Self-hosted | Your PostHog instance URL |

## License

Apache-2.0
