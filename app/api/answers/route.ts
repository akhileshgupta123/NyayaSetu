import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { answers, messages } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async (request) => {
  try {
    const messageId = new URL(request.url).searchParams.get('messageId')
    if (!messageId) return errorResponse('Message id is required.')
    const rows = await scopedRepo(answers).findMany({ where: eq(answers.message_id, messageId), orderBy: asc(answers.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Answers could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.messageId !== 'string' || !body.messageId) return errorResponse('Message id is required.')
    if (typeof body?.answerText !== 'string' || !body.answerText.trim()) return errorResponse('Answer text is required.')
    const message = await scopedRepo(messages).findOne(eq(messages.id, body.messageId))
    if (!message) return errorResponse('Message not found.', 404)
    const [row] = await scopedRepo(answers).insert({ message_id: body.messageId, answer_text: body.answerText.trim().slice(0, 30000), is_grounded: body.isGrounded === true, confidence_score: typeof body.confidenceScore === 'number' ? body.confidenceScore : null, prompt_version_id: typeof body.promptVersionId === 'string' ? body.promptVersionId : null })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Answer could not be saved.')
  }
})
