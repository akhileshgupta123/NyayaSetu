import { evaluateOneCase } from '@/lib/weekFourEvaluation'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.id !== 'string' || typeof body.question !== 'string' || typeof body.expected !== 'string' || typeof body.category !== 'string' || typeof body.prompt_mode !== 'string') return Response.json({ success: false, error: 'id, question, expected, category, and prompt_mode are required' }, { status: 400 })
  return Response.json({ success: true, data: evaluateOneCase({ id: body.id, question: body.question, expected: body.expected, category: body.category, promptMode: body.prompt_mode, ragEnabled: body.rag_enabled === true, index: Number(body.index || 0) }) })
}
