import { assertEquals } from 'https://deno.land/std@0.224.0/testing/asserts.ts'
import { describe, it } from 'https://deno.land/std@0.224.0/testing/bdd.ts'
import { handler } from './reverse-string'

describe('Reverse String Edge Function', () => {
  it('should reverse a valid string', async () => {
    const req = new Request('http://localhost:54321/functions/v1/reverse-string?text=hello')
    const res = await handler(req)
    const body = await res.json()

    assertEquals(res.status, 200)
    assertEquals(body.original, 'hello')
    assertEquals(body.reversed, 'olleh')
  })

  it('should handle special characters and spaces', async () => {
    const req = new Request('http://localhost:54321/functions/v1/reverse-string?text=Hello,%20World!')
    const res = await handler(req)
    const body = await res.json()

    assertEquals(res.status, 200)
    assertEquals(body.original, 'Hello, World!')
    assertEquals(body.reversed, '!dlroW ,olleH')
  })

  it('should return 400 if text parameter is missing', async () => {
    const req = new Request('http://localhost:54321/functions/v1/reverse-string')
    const res = await handler(req)
    const body = await res.json()

    assertEquals(res.status, 400)
    assertEquals(body.error, "Missing 'text' query parameter")
  })
})
