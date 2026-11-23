import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { conversations, messages } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

function scrubText(text: string) {
  let redacted = text
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  const phonePattern = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g
  const accountPattern = /\b\d{12,16}\b/g
  redacted = redacted.replace(emailPattern, '[EMAIL REDACTED]')
  redacted = redacted.replace(phonePattern, '[PHONE REDACTED]')
  redacted = redacted.replace(accountPattern, '[IDENTIFIER REDACTED]')
  return { redacted, containsPii: redacted !== text }
}

export const GET = authMiddleware(async (request) => {
  try {
    const conversationId = new URL(request.url).searchParams.get('conversationId')
    const where = conversationId ? eq(messages.conversation_id, conversationId) : undefined
    const rows = await scopedRepo(messages).findMany({ where, orderBy: asc(messages.sequence_number) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Messages could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.conversationId !== 'string' || !body.conversationId) return errorResponse('Conversation id is required.')
    if (typeof body?.originalText !== 'string' || !body.originalText.trim()) return errorResponse('Message text is required.')
    const conversation = await scopedRepo(conversations).findOne(eq(conversations.id, body.conversationId))
    if (!conversation) return errorResponse('Conversation not found.', 404)
    const originalText = body.originalText.trim().slice(0, 16000)
    const scrubbed = scrubText(originalText)
    const suppliedRedacted = typeof body.redactedText === 'string' ? body.redactedText.trim().slice(0, 16000) : scrubbed.redacted
    const redactedText = suppliedRedacted === scrubbed.redacted ? suppliedRedacted : scrubbed.redacted
    const [row] = await scopedRepo(messages).insert({ conversation_id: body.conversationId, sequence_number: typeof body.sequenceNumber === 'number' ? body.sequenceNumber : 0, role: typeof body.role === 'string' ? body.role.slice(0, 30) : 'user', original_text: originalText, redacted_text: redactedText, contains_pii: scrubbed.containsPii })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Message could not be saved.')
  }
})
