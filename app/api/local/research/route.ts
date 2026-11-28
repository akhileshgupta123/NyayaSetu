import { hybridRetrieve } from '@/lib/hybridRetrieval'
import { scrubPII } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.question !== 'string' || !body.question.trim()) return Response.json({ success: false, error: 'question is required' }, { status: 400 })
  const scrubbed = scrubPII(body.question)
  const result = hybridRetrieve(scrubbed.redacted, 3)
  return Response.json({ success: true, response: { status: 'success', result, message: 'Local synthetic hybrid retrieval completed.', metadata: { agent_name: 'Local Synthetic Research Pipeline', timestamp: new Date().toISOString(), model_version: 'bm25-hash96-rrf-rerank-v1', redaction_confirmed: true } }, privacy: scrubbed })
}
