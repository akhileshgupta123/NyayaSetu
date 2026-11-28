import { runFinalGrid } from '@/lib/weekFourEvaluation'

export async function POST() {
  return Response.json({ success: true, data: await runFinalGrid() })
}
