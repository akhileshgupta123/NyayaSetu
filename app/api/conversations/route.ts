import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { conversations } from '@/lib/db/schema'
import { desc, eq, isNull } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async () => {
  try {
    const rows = await scopedRepo(conversations).findMany({ where: isNull(conversations.deleted_at), orderBy: desc(conversations.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Conversations could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 160) : 'Untitled conversation'
    const status = typeof body?.status === 'string' && body.status.trim() ? body.status.trim().slice(0, 40) : 'open'
    const [row] = await scopedRepo(conversations).insert({ title, status })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Conversation could not be created.')
  }
})

export const PUT = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.id !== 'string' || !body.id) return errorResponse('Conversation id is required.')
    const updates: Record<string, string | Date> = {}
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 160)
    if (typeof body.status === 'string' && body.status.trim()) updates.status = body.status.trim().slice(0, 40)
    if (body.reopen === true) updates.reopened_at = new Date()
    if (body.exported === true) updates.exported_at = new Date()
    if (Object.keys(updates).length === 0) return errorResponse('No conversation changes were supplied.')
    const [row] = await scopedRepo(conversations).update(eq(conversations.id, body.id), updates)
    if (!row) return errorResponse('Conversation not found.', 404)
    return Response.json({ success: true, data: row })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Conversation could not be updated.')
  }
})

export const DELETE = authMiddleware(async (request) => {
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return errorResponse('Conversation id is required.')
    const [row] = await scopedRepo(conversations).update(eq(conversations.id, id), { deleted_at: new Date(), status: 'deleted' })
    if (!row) return errorResponse('Conversation not found.', 404)
    return Response.json({ success: true, data: row })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Conversation could not be deleted.')
  }
})
