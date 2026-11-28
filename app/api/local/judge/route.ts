import { evaluateProvidedAnswer } from '@/lib/weekFourEvaluation'
import { scrubPII } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.input !== 'string' || typeof body.expected !== 'string' || typeof body.actual !== 'string') return Response.json({ success: false, error: 'input, expected, and actual are required' }, { status: 400 })
  const category = typeof body.category === 'string' && body.category !== 'all' ? body.category : 'fact-information'
  const result = evaluateProvidedAnswer({ question: scrubPII(body.input).redacted, expected: body.expected, actual: body.actual, category, promptMode: typeof body.prompt_mode === 'string' ? body.prompt_mode : 'few-shot', ragEnabled: body.rag_enabled === true })
  return Response.json({ success: true, response: { status: 'success', result, message: 'Synthetic Judge v2 evaluation completed.', metadata: { agent_name: 'NyayaSetu Synthetic Judge v2', timestamp: new Date().toISOString(), model_version: 'synthetic-judge-v2-fallback', redaction_confirmed: true } } })
}
