import { runWeekOneBaseline } from '@/lib/weekOneBaseline'

export async function POST() {
  const result = await runWeekOneBaseline()
  return Response.json({ success: true, data: result })
}
