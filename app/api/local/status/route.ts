import { getCorpus, getGold, ollamaStatus } from '@/lib/localLegal'

export async function GET() {
  const ollama = await ollamaStatus()
  return Response.json({
    success: true,
    data: {
      mode: 'synthetic_demo',
      corpus_rows: getCorpus().length,
      gold_rows: getGold().length,
      retrieval: 'local lexical + trigram semantic fusion + reranking',
      ollama,
      disclaimer: 'Synthetic demonstration data is active and is not authoritative legal material.',
    },
  })
}
