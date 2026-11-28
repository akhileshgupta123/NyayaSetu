import { ollamaStatus } from '@/lib/localLegal'
import { hybridIndexStatus } from '@/lib/hybridRetrieval'

export async function GET() {
  const ollama = await ollamaStatus()
  const index = hybridIndexStatus()
  return Response.json({ success: true, data: { release: 'hackathon-week4-v1', app: 'ready', database: 'configured at deployment', retrieval_index: index.loaded ? 'ready' : 'unavailable', corpus_rows: index.corpus_rows, ollama, judge: ollama.models.some(model=>model.includes('gemma3')) ? 'gemma3 available' : 'synthetic Judge v2 fallback ready', builder: ollama.available ? 'Ollama-aware grounded Builder' : 'deterministic grounded fallback ready', exports: ['csv','json'], retry: 'per-case supported' } })
}
