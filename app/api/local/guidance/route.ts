import { buildGuidance, scrubPII } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.question !== 'string' || !body.question.trim()) return Response.json({ success: false, error: 'question is required' }, { status: 400 })
  const scrubbed = scrubPII(body.question)
  const result = buildGuidance(scrubbed.redacted, body.amount_paid)
  return Response.json({ success: true, response: { status: 'success', result, message: 'Local synthetic guidance pipeline completed.', metadata: { agent_name: 'NyayaSetu Local Demonstration Pipeline', timestamp: new Date().toISOString(), model_version: 'deterministic-local-v1', redaction_confirmed: true } }, privacy: scrubbed })
}
