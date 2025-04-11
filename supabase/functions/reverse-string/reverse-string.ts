import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

/**
 * Reverse String Edge Function
 * Takes a string as a query parameter and returns the reversed string.
 */
export const handler = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const text = url.searchParams.get('text')

    // Validate input
    if (!text) {
      return new Response(JSON.stringify({ error: "Missing 'text' query parameter" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // Reverse the string
    const reversed = text.split('').reverse().join('')

    return new Response(
      JSON.stringify({
        original: text,
        reversed,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

serve(handler)
