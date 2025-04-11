# Reverse String Edge Function

## Purpose

This Edge Function takes a string as a query parameter (`text`) and returns the reversed string. It serves as a simple
example of how to create, document, and test a serverless function using Deno within the Supabase ecosystem.

## Features

- Reverses any string provided as input
- Includes proper error handling
- CORS support for cross-origin requests
- Comprehensive test coverage
- Response includes original text, reversed text, and timestamp

## Input/Output

### Input

- **Query Parameter**: `text` (string) - The string to reverse.
  - Example: `?text=hello`

### Output

- **Success (200)**: A JSON object with the original text, reversed text, and timestamp.
  ```json
  {
    "original": "hello",
    "reversed": "olleh",
    "timestamp": "2025-04-12T15:30:45.123Z"
  }
  ```
- **Error (400)**: If the `text` parameter is missing.
  ```json
  {
    "error": "Missing 'text' query parameter"
  }
  ```
- **Error (500)**: For unexpected server errors.
  ```json
  {
    "error": "Internal server error"
  }
  ```

## Deployment Instructions

1. Ensure you have the Supabase CLI installed:

   ```bash
   npm install -g supabase
   ```

2. Initialize Supabase (if not already done):

   ```bash
   supabase init
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy reverse-string
   ```

## Testing

### Local Testing

1. Start the function locally:

   ```bash
   supabase functions serve reverse-string
   ```

2. Test using curl:
   ```bash
   curl "http://localhost:54321/functions/v1/reverse-string?text=hello"
   ```

### Automated Testing

Run the automated tests:

```bash
deno test supabase/functions/reverse-string_test.ts
```

## Example Usage

### Browser

```javascript
const response = await fetch('https://YOUR_PROJECT_REF.supabase.co/functions/v1/reverse-string?text=hello')
const data = await response.json()
console.log(data.reversed) // Outputs: olleh
```

### Node.js

```javascript
const fetch = require('node-fetch')

async function reverseString(text) {
  const response = await fetch(
    `https://YOUR_PROJECT_REF.supabase.co/functions/v1/reverse-string?text=${encodeURIComponent(text)}`
  )
  const data = await response.json()
  return data.reversed
}

reverseString('hello').then(console.log) // Outputs: olleh
```

## Best Practices Implemented

- Proper error handling with appropriate HTTP status codes
- CORS headers for cross-origin requests
- Comprehensive documentation
- Detailed test coverage
- Clean, maintainable code structure
- Input validation
- Logging for errors
