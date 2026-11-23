import { runEvaluation } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const promptMode = typeof body?.prompt_mode === 'string' ? body.prompt_mode : 'few-shot'
  const category = typeof body?.category === 'string' ? body.category : 'all'
  const result = runEvaluation(promptMode, body?.rag_enabled !== false, category)
  return Response.json({ success: true, data: result })
}
