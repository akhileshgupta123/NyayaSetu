import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { auditEvents, conversations } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async () => {
  try {
    const rows = await scopedRepo(auditEvents).findMany({ orderBy: desc(auditEvents.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Audit events could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.eventType !== 'string' || !body.eventType.trim()) return errorResponse('Event type is required.')
    if (body.relatedConversationId && typeof body.relatedConversationId === 'string') {
      const conversation = await scopedRepo(conversations).findOne(eq(conversations.id, body.relatedConversationId))
      if (!conversation) return errorResponse('Conversation not found.', 404)
    }
    const eventData = body.eventData && typeof body.eventData === 'object' && !Array.isArray(body.eventData) ? body.eventData : {}
    const [row] = await scopedRepo(auditEvents).insert({ event_type: body.eventType.trim().slice(0, 120), event_data: eventData, is_redacted: body.isRedacted !== false, related_conversation_id: typeof body.relatedConversationId === 'string' ? body.relatedConversationId : null })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Audit event could not be recorded.')
  }
})
