import { runWeekThreeBenchmark } from '@/lib/weekThreeBuilder'

export async function POST() {
  return Response.json({ success: true, data: await runWeekThreeBenchmark() })
}
