import { generateChat, type ChatMessage } from '@/lib/weekOneBaseline'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) return Response.json({ error: { message: 'messages must be a non-empty array', type: 'invalid_request_error' } }, { status: 400 })
  const messages = body.messages.filter((item: unknown): item is ChatMessage => Boolean(item && typeof item === 'object' && 'role' in item && 'content' in item && typeof (item as ChatMessage).content === 'string'))
  if (!messages.length) return Response.json({ error: { message: 'No valid chat messages were supplied', type: 'invalid_request_error' } }, { status: 400 })
  const result = await generateChat(messages, typeof body.model === 'string' ? body.model : undefined)
  const created = Math.floor(Date.now() / 1000)
  return Response.json({ id: `chatcmpl-local-${created}`, object: 'chat.completion', created, model: result.model, choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, local_runtime: { backend: result.backend, fallback_used: result.fallback_used, latency_ms: result.latency_ms, warning: result.warning, temperature: 0 } })
}
