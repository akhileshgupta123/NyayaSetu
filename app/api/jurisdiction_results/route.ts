import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { conversations, jurisdictionResults, messages } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

function parseAmount(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const amount = Number(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function commissionFor(amount: number) {
  if (amount <= 5000000) return 'District Consumer Disputes Redressal Commission'
  if (amount <= 20000000) return 'State Consumer Disputes Redressal Commission'
  return 'National Consumer Disputes Redressal Commission'
}

export const GET = authMiddleware(async (request) => {
  try {
    const conversationId = new URL(request.url).searchParams.get('conversationId')
    const rows = await scopedRepo(jurisdictionResults).findMany({ where: conversationId ? eq(jurisdictionResults.conversation_id, conversationId) : undefined, orderBy: desc(jurisdictionResults.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Jurisdiction results could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.conversationId !== 'string' || !body.conversationId) return errorResponse('Conversation id is required.')
    const conversation = await scopedRepo(conversations).findOne(eq(conversations.id, body.conversationId))
    if (!conversation) return errorResponse('Conversation not found.', 404)
    if (body.messageId && typeof body.messageId === 'string') {
      const message = await scopedRepo(messages).findOne(eq(messages.id, body.messageId))
      if (!message) return errorResponse('Message not found.', 404)
    }
    const amount = parseAmount(body.amountPaid)
    const forum = amount ? commissionFor(amount) : null
    const [row] = await scopedRepo(jurisdictionResults).insert({ conversation_id: body.conversationId, message_id: typeof body.messageId === 'string' ? body.messageId : null, state: typeof body.state === 'string' ? body.state.trim().slice(0, 120) : null, district: typeof body.district === 'string' ? body.district.trim().slice(0, 120) : null, forum_type: forum, determined_at: new Date(), determination_basis: { amount_used: amount, compensation_sought: body.compensationSought ?? null, rule_version: '2021 configuration preview', effective_date: null, source_status: 'official notification not connected' } })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Jurisdiction could not be calculated.')
  }
})
