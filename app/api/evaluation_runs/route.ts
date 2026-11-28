import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { evaluationRuns } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async () => {
  try {
    const rows = await scopedRepo(evaluationRuns).findMany({ orderBy: desc(evaluationRuns.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Evaluation runs could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.name !== 'string' || !body.name.trim()) return errorResponse('Evaluation run name is required.')
    const [row] = await scopedRepo(evaluationRuns).insert({ name: body.name.trim().slice(0, 240), status: typeof body.status === 'string' ? body.status.slice(0, 40) : 'pending', prompt_version_id: typeof body.promptVersionId === 'string' ? body.promptVersionId : null, started_at: new Date(), summary: body.summary && typeof body.summary === 'object' ? body.summary : { dataset_status: 'not registered' } })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Evaluation run could not be recorded.')
  }
})

export const PUT = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.id !== 'string' || !body.id) return errorResponse('Evaluation run id is required.')
    const [row] = await scopedRepo(evaluationRuns).update(eq(evaluationRuns.id, body.id), { status: typeof body.status === 'string' ? body.status.slice(0, 40) : 'pending', completed_at: body.completed === true ? new Date() : null, summary: body.summary && typeof body.summary === 'object' ? body.summary : null })
    if (!row) return errorResponse('Evaluation run not found.', 404)
    return Response.json({ success: true, data: row })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Evaluation run could not be updated.')
  }
})
