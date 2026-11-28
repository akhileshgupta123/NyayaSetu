import { runRecallAt3Benchmark } from '@/lib/hybridRetrieval'

export async function POST() {
  return Response.json({ success: true, data: runRecallAt3Benchmark() })
}
