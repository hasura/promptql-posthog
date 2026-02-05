# CLAUDE.md - PromptQL Function Generator

This file provides instructions for Claude Code to generate, validate, and test PromptQL-compliant TypeScript functions for Hasura NDC Lambda SDK.

## Overview

**Purpose**: Generate TypeScript functions that work with Hasura's NDC Lambda SDK for PromptQL.

**Runtime**: Node.js 20+

**Core SDK**: `@hasura/ndc-lambda-sdk`

When a user asks to generate a function (e.g., "generate a function to send emails"), you must:
1. Create `package.json` if it doesn't exist
2. Create `tsconfig.json` if it doesn't exist
3. Create or update `functions.ts` with the generated function
4. Run `npm install`
5. Run `npx tsc --noEmit` to validate
6. Summarise environment variables and npm dependencies (non default) to the user
7. Indicate user to upload each function separately if there are multiple functions

---

## Project Setup

### Required Files

If these files don't exist, create them before generating functions.

**package.json:**
```json
{
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "ndc-lambda-sdk host -f functions.ts serve --configuration ./",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hasura/ndc-lambda-sdk": "1.16.0"
  },
  "devDependencies": {
    "@tsconfig/node20": "^20.1.0",
    "typescript": "^5.0.0"
  }
}
```

**tsconfig.json:**
```json
{
  "extends": "./node_modules/@tsconfig/node20/tsconfig.json"
}
```

### Adding Dependencies

When generating functions that require additional npm packages:
1. Add them to the `dependencies` section in `package.json`
2. Use caret (^) version ranges (e.g., `"axios": "^1.6.0"`)
3. Do NOT add `@hasura/ndc-lambda-sdk`, `node-fetch`, or `dotenv-cli` - they are already available

---

## Function Requirements (CRITICAL)

All generated functions MUST follow these rules exactly.

### Signature Rules

1. **Always use `export async function`**
   ```typescript
   // CORRECT
   export async function my_function(param: string): Promise<{ result: string }> { ... }

   // WRONG - not exported
   async function my_function() { ... }

   // WRONG - not async
   export function my_function() { ... }
   ```

2. **Parameters must be scalar types or objects of scalars**

   Allowed scalar types: `string`, `number`, `boolean`, `bigint`, `Date`

   ```typescript
   // CORRECT - scalar parameters
   export async function process(id: string, count: number): Promise<...>

   // CORRECT - object of scalars
   export async function process(config: { url: string; timeout: number }): Promise<...>

   // WRONG - Buffer is not a scalar
   export async function process(file: Buffer): Promise<...>

   // WRONG - complex nested objects with non-scalars
   export async function process(data: { buffer: Buffer }): Promise<...>
   ```

3. **Return type MUST always be an object**

   Never return: `void`, `null`, `undefined`, or scalar values directly

   ```typescript
   // CORRECT - returns object
   export async function get_user(id: string): Promise<{ name: string; email: string }>

   // CORRECT - wrap scalar in object
   export async function get_count(): Promise<{ count: number }>

   // WRONG - returns scalar
   export async function get_name(id: string): Promise<string>

   // WRONG - returns void
   export async function update_user(id: string): Promise<void>
   ```

### JSDoc Requirements

1. **All functions must have JSDoc comments**
   ```typescript
   /**
    * Fetches user data from the database
    * @param userId - The unique identifier for the user
    * @return User object with profile information
    */
   export async function get_user(userId: string): Promise<UserResponse> { ... }
   ```

2. **Use `@readonly` tag for read-only functions**

   If a function only fetches/reads data without side effects (no mutations, no external writes), add the `@readonly` tag:

   ```typescript
   /**
    * @readonly
    * Fetches weather data for a location
    * @param city - City name to get weather for
    * @return Weather data including temperature and conditions
    */
   export async function get_weather(city: string): Promise<WeatherResponse> { ... }
   ```

### Error Handling

Always use `sdk.UnprocessableContent` for errors:

```typescript
import * as sdk from '@hasura/ndc-lambda-sdk';

export async function my_function(input: string): Promise<{ result: string }> {
  try {
    // Function logic here
    return { result: "success" };
  } catch (error) {
    throw new sdk.UnprocessableContent(
      "Operation failed: " + (error instanceof Error ? error.message : JSON.stringify(error))
    );
  }
}
```

### Environment Variables

For secrets, API keys, and configuration:

1. Use `process.env.VAR_NAME`
2. Use SCREAMING_SNAKE_CASE naming
3. Provide fallback or clear error message if missing
4. Document in JSDoc what env vars are required

```typescript
/**
 * Sends an email via external API
 * @param recipient - Email address
 * @param subject - Email subject
 * @param body - Email body content
 * @return Send confirmation with message ID
 *
 * Required environment variables:
 * - EMAIL_API_KEY: API key for the email service
 * - EMAIL_API_URL: Base URL for the email API (optional, defaults to production)
 */
export async function send_email(
  recipient: string,
  subject: string,
  body: string
): Promise<{ messageId: string; status: string }> {
  const API_KEY = process.env.EMAIL_API_KEY;
  if (!API_KEY) {
    throw new sdk.UnprocessableContent("EMAIL_API_KEY environment variable is required");
  }
  // ...
}
```

---

## Complete Example

Here's a complete, working function that demonstrates all requirements:

```typescript
import * as sdk from '@hasura/ndc-lambda-sdk';

/**
 * @readonly
 * Fetches current weather data for a specified city using OpenWeatherMap API
 * @param city - The city name to get weather for (e.g., "London", "New York")
 * @param units - Temperature units: "metric" (Celsius) or "imperial" (Fahrenheit)
 * @return Weather data including temperature, description, and humidity
 *
 * Required environment variables:
 * - OPENWEATHER_API_KEY: Your OpenWeatherMap API key
 */
export async function get_weather(
  city: string,
  units: string = "metric"
): Promise<WeatherResponse> {
  const API_KEY = process.env.OPENWEATHER_API_KEY;

  if (!API_KEY) {
    throw new sdk.UnprocessableContent("OPENWEATHER_API_KEY environment variable is required");
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as OpenWeatherResponse;

    return {
      city: data.name,
      country: data.sys.country,
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      description: data.weather[0]?.description ?? "Unknown",
      units: units === "metric" ? "Celsius" : "Fahrenheit",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new sdk.UnprocessableContent(
      "Weather fetch failed: " + (error instanceof Error ? error.message : JSON.stringify(error))
    );
  }
}

// Type definitions
interface WeatherResponse {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  units: string;
  timestamp: string;
}

interface OpenWeatherResponse {
  name: string;
  sys: { country: string };
  main: { temp: number; feels_like: number; humidity: number };
  weather: Array<{ description: string }>;
}
```

---

## Anti-Patterns (DO NOT DO)

### Return Types

```typescript
// WRONG - returns string scalar
export async function get_name(): Promise<string> { return "John"; }

// CORRECT - wrap in object
export async function get_name(): Promise<{ name: string }> { return { name: "John" }; }

// WRONG - returns void
export async function update(): Promise<void> { ... }

// CORRECT - return confirmation object
export async function update(): Promise<{ success: boolean }> { return { success: true }; }

// WRONG - returns null
export async function find(): Promise<User | null> { ... }

// CORRECT - return object with nullable field or empty state
export async function find(): Promise<{ user: User | null; found: boolean }> { ... }
```

### Type Safety

```typescript
// WRONG - using any
export async function process(data: any): Promise<{ result: any }> { ... }

// CORRECT - define proper types
interface InputData { id: string; value: number; }
interface OutputData { processedValue: number; }
export async function process(data: InputData): Promise<OutputData> { ... }

// WRONG - untyped JSON response
const data = await response.json();

// CORRECT - cast to typed interface
const data = await response.json() as MyResponseType;
```

### Dependencies

```typescript
// WRONG - importing packages that are already available
import fetch from 'node-fetch';  // Already available globally

// CORRECT - just use fetch directly
const response = await fetch(url);

// WRONG - adding these to package.json (already included)
// "@hasura/ndc-lambda-sdk", "node-fetch", "dotenv-cli"
```

---

## Validation Workflow

After generating or modifying a function, ALWAYS run these commands:

```bash
# 1. Install dependencies (including any new ones added)
npm install

# 2. TypeScript compile check - MUST pass with no errors
npx tsc --noEmit

# 3. Optional: Run the function server locally for testing
npm start
```

### Validation Checklist

Before completing a function generation task, verify:

- [ ] Function uses `export async function`
- [ ] Return type is an object (not scalar, void, null, or undefined)
- [ ] Parameters use scalar types or objects of scalars only
- [ ] JSDoc comments are present with `@param` and `@return`
- [ ] Read-only functions have `@readonly` tag
- [ ] Error handling uses `sdk.UnprocessableContent`
- [ ] Environment variables documented in JSDoc
- [ ] All types are properly defined (no `any`)
- [ ] `npm install` completes successfully
- [ ] `npx tsc --noEmit` passes with no errors

---

## Handling Multiple Functions

If users asks to add more than one function, or add a new function when an existing is already generated, you must:

1. create a  `functions` folder
2. keep each function in a separate file, use name of function as filename.
2. at the top level function.ts, import all the functions from the functions folder
3. Define all type interfaces at the bottom of the file
4. Import `sdk` once at the top
5. Each function should be independent and self-contained

```typescript
import * as sdk from '@hasura/ndc-lambda-sdk';

/**
 * @readonly
 * First function...
 */
export async function function_one(...): Promise<...> { ... }

/**
 * Second function...
 */
export async function function_two(...): Promise<...> { ... }

// Type definitions
interface TypeOne { ... }
interface TypeTwo { ... }
```

---

## Troubleshooting

### Common TypeScript Errors

**"Cannot find module '@hasura/ndc-lambda-sdk'"**
- Run `npm install` first

**"Type 'X' is not assignable to type 'Y'"**
- Check your interface definitions match the actual data structure
- Cast JSON responses properly: `await response.json() as MyType`

**"Property 'X' does not exist on type 'Y'"**
- Define all properties in your interface
- Use optional properties (`prop?: type`) for fields that may not exist

**"Unused variable 'X'"**
- Remove unused variables or prefix with underscore: `_unusedVar`

### npm Install Failures

**"404 Not Found" for a package**
- Check package name spelling
- Verify the package exists on npm
- Check if it's been deprecated/renamed

**Peer dependency conflicts**
- Try `npm install --legacy-peer-deps`
- Or update conflicting package versions
