import { hybridIndexStatus } from '@/lib/hybridRetrieval'

export async function GET() {
  return Response.json({ success: true, data: hybridIndexStatus() })
}
