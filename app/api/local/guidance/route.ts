import { buildGroundedGuidance } from '@/lib/weekThreeBuilder'
import { scrubPII } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.question !== 'string' || !body.question.trim()) return Response.json({ success: false, error: 'question is required' }, { status: 400 })
  const scrubbed = scrubPII(body.question)
  const built = await buildGroundedGuidance(scrubbed.redacted, body.amount_paid)
  return Response.json({ success: true, response: { status: 'success', result: built.result, message: 'Week 3 grounded guidance pipeline completed.', metadata: { agent_name: 'NyayaSetu Grounded Builder', timestamp: new Date().toISOString(), model_version: built.metadata.model, redaction_confirmed: true, ...built.metadata } }, privacy: scrubbed })
}
