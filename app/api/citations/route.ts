import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { answers, citations } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async (request) => {
  try {
    const answerId = new URL(request.url).searchParams.get('answerId')
    if (!answerId) return errorResponse('Answer id is required.')
    const rows = await scopedRepo(citations).findMany({ where: eq(citations.answer_id, answerId), orderBy: asc(citations.rank) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Citations could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.answerId !== 'string' || !body.answerId) return errorResponse('Answer id is required.')
    if (typeof body?.sourceTitle !== 'string' || !body.sourceTitle.trim()) return errorResponse('Source title is required.')
    const answer = await scopedRepo(answers).findOne(eq(answers.id, body.answerId))
    if (!answer) return errorResponse('Answer not found.', 404)
    const [row] = await scopedRepo(citations).insert({ answer_id: body.answerId, source_title: body.sourceTitle.trim().slice(0, 500), source_url: typeof body.sourceUrl === 'string' ? body.sourceUrl.slice(0, 2000) : null, excerpt: typeof body.excerpt === 'string' ? body.excerpt.slice(0, 8000) : null, rank: typeof body.rank === 'number' ? body.rank : 0 })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Citation could not be saved.')
  }
})
