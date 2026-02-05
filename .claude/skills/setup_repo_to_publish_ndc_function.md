# Skill: Setup Repository to Publish NDC Function Connector

This skill guides you through restructuring a Hasura NDC Lambda SDK connector for publication to ndc-hub.

## When to Use

Use this skill when you need to:
- Prepare an NDC function connector for publication to ndc-hub
- Restructure a connector from a nested DDN supergraph to standalone
- Package a connector following the ndc-hub packaging specification

## Required Root-Level Structure

```
your-connector/
├── .hasura-connector/           # Required by ndc-hub
│   ├── connector-metadata.yaml  # Connector metadata with env vars
│   ├── Dockerfile               # Docker build configuration
│   └── Dockerfile.dockerignore  # Docker ignore patterns
├── functions.ts                 # Main connector entry point
├── functions/                   # Individual function files (if multiple)
│   └── *.ts
├── package.json                 # NPM package metadata
├── package-lock.json            # Dependency lock file
├── tsconfig.json                # TypeScript configuration
├── README.md                    # Documentation
├── .gitignore
├── .dockerignore
└── .github/
    └── workflows/
        └── build-and-push.yml   # Docker image publishing workflow
```

## Step-by-Step Process

### Step 1: Create .hasura-connector Directory

Create the `.hasura-connector/` directory with three files:

**connector-metadata.yaml:**
```yaml
version: v2
ndcSpecGeneration: v0.2
packagingDefinition:
  type: ManagedDockerBuild
supportedEnvironmentVariables:
  - name: YOUR_API_KEY
    description: "API key for authentication"
  - name: YOUR_PROJECT_ID
    description: "Project identifier"
  - name: YOUR_HOST
    description: "API host URL"
    defaultValue: "api.example.com"
commands:
  upgradeConfiguration:
    type: Dockerized
    dockerImage: ghcr.io/hasura/ndc-nodejs-lambda:v1.18.0
    commandArgs:
      - /scripts/upgrade.sh
dockerComposeWatch:
  - path: package.json
    action: rebuild
    target: /functions/package.json
  - path: package-lock.json
    action: rebuild
    target: /functions/package-lock.json
  - path: ./
    action: sync+restart
    target: /functions
```

**Dockerfile:**
```dockerfile
FROM ghcr.io/hasura/ndc-nodejs-lambda:v1.18.0

COPY package-lock.json package.json /functions/

WORKDIR /functions
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY ./ /functions
```

**Dockerfile.dockerignore:**
```
.hasura-connector/
*.hml
node_modules/
```

### Step 2: Update package.json

Remove `"private": true` and add publication metadata:

```json
{
  "name": "your-connector-name",
  "version": "0.1.0",
  "description": "Hasura NDC connector for [service] - [brief description]",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/hasura/your-connector-name"
  },
  "keywords": [
    "hasura",
    "ndc",
    "connector",
    "your-service"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "ndc-lambda-sdk host -f functions.ts serve --configuration ./",
    "watch": "ndc-lambda-sdk host -f functions.ts --watch serve --configuration ./ --pretty-print-logs"
  },
  "dependencies": {
    "@hasura/ndc-lambda-sdk": "1.18.0"
  }
}
```

### Step 3: Structure Functions

**Single function** - use `functions.ts` directly.

**Multiple functions** - create a `functions/` directory:
```
functions/
├── function_one.ts
├── function_two.ts
└── function_three.ts
```

And re-export from `functions.ts`:
```typescript
export { function_one } from './functions/function_one';
export { function_two } from './functions/function_two';
export { function_three } from './functions/function_three';
```

### Step 4: Create tsconfig.json

```json
{
  "extends": "./node_modules/@tsconfig/node20/tsconfig.json"
}
```

### Step 5: Create .dockerignore (Root)

```
./node_modules/**
**/node_modules/**
./dist/**

# test files
**/test-data/**
./tests/**
**/*.test.ts

# scripts
./scripts/**

# Git and IDE
.git/
.gitignore
.vscode/
.idea/

# Environment files
.env
.env.*

# Documentation (not needed in container)
*.md
```

### Step 6: Update .gitignore

Ensure these patterns are included:
```
node_modules/
dist/
.env
.env.*
*.tgz
.hasura-connector/*.tgz
```

### Step 7: Create README.md

Document:
- What the connector does
- All supported functions with parameters and return types
- Required environment variables (table format)
- Setup instructions (DDN CLI, local development, Docker)
- GraphQL usage examples
- Any service-specific notes (hosts, regions, etc.)

### Step 8: Create GitHub Workflow

**.github/workflows/build-and-push.yml:**
```yaml
name: Build and Push Multi-arch Docker Image

on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version to build and push (e.g., 0.1.0)"
        required: true
        type: string

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: hasura/your-connector-name

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        run: |
          docker buildx build \
            --platform linux/amd64,linux/arm64 \
            --file .hasura-connector/Dockerfile \
            --tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:v${{ inputs.version }} \
            --push \
            .
```

## Verification Checklist

After setup, verify:

1. **TypeScript compiles:**
   ```bash
   npm install
   npx tsc --noEmit
   ```

2. **Docker builds:**
   ```bash
   docker build -f .hasura-connector/Dockerfile -t your-connector .
   ```

3. **Connector starts:**
   ```bash
   npm start
   ```

4. **connector-metadata.yaml is valid:**
   - All required environment variables listed
   - Descriptions are clear and helpful
   - Default values provided where appropriate

## Function Writing Requirements

All functions must follow these rules (see docs/function-writing.md for details):

- Use `export async function`
- Return type must be an object (never scalar, void, null)
- Parameters must be scalars or objects of scalars
- Include JSDoc with `@param` and `@return`
- Use `@readonly` tag for read-only functions
- Use `sdk.UnprocessableContent` for errors
- Document required environment variables in JSDoc

## References

- [ndc-hub Packaging Specification](https://github.com/hasura/ndc-hub/blob/main/rfcs/0001-packaging.md)
- [NDC Lambda SDK](https://github.com/hasura/ndc-nodejs-lambda)
