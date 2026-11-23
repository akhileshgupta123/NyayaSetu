import { calculateJurisdiction } from '@/lib/localLegal'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ success: false, error: 'JSON body is required' }, { status: 400 })
  return Response.json({ success: true, data: calculateJurisdiction(body.amount_paid) })
}
