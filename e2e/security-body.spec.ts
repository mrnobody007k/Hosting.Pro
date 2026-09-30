import { expect, test } from '@playwright/test'
import { readJson, RequestSecurityError } from '../lib/security'

test('readJson rejects oversized declared Content-Length', async () => {
  const request = new Request('http://127.0.0.1/api/test', {
    method: 'POST',
    headers: { 'content-length': '9' },
    body: '{}',
  })
  await expect(readJson(request, 8)).rejects.toMatchObject({ status: 413 })
})

test('readJson cancels an oversized streamed body without Content-Length', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('1234'))
      controller.enqueue(new TextEncoder().encode('5678'))
    },
    cancel() { cancelled = true },
  })
  const request = new Request('http://127.0.0.1/api/test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
  await expect(readJson(request, 6)).rejects.toMatchObject({ status: 413 })
  expect(cancelled).toBe(true)
})

test('readJson accepts a body exactly at the byte limit', async () => {
  const value = '{"ok":true}'
  await expect(readJson(new Request('http://127.0.0.1/api/test', { method: 'POST', body: value }), new TextEncoder().encode(value).byteLength)).resolves.toEqual({ ok: true })
})

test('readJson counts multibyte UTF-8 bytes', async () => {
  const value = '{"value":"é"}'
  const bytes = new TextEncoder().encode(value).byteLength
  await expect(readJson(new Request('http://127.0.0.1/api/test', { method: 'POST', body: value }), bytes)).resolves.toEqual({ value: 'é' })
  await expect(readJson(new Request('http://127.0.0.1/api/test', { method: 'POST', body: value }), bytes - 1)).rejects.toMatchObject({ status: 413 })
})

test('readJson preserves malformed JSON client errors', async () => {
  await expect(readJson(new Request('http://127.0.0.1/api/test', { method: 'POST', body: '{' }))).rejects.toMatchObject({ status: 400, message: 'Invalid JSON request.' })
})
