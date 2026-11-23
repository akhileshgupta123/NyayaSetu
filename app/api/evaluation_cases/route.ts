import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { evaluationCases, evaluationRuns } from '@/lib/db/schema'
import { asc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async (request) => {
  try {
    const runId = new URL(request.url).searchParams.get('evaluationRunId')
    if (!runId) return errorResponse('Evaluation run id is required.')
    const rows = await scopedRepo(evaluationCases).system().findMany({ where: eq(evaluationCases.evaluation_run_id, runId), orderBy: asc(evaluationCases.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Evaluation cases could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.evaluationRunId !== 'string' || !body.evaluationRunId) return errorResponse('Evaluation run id is required.')
    if (typeof body?.inputText !== 'string' || !body.inputText.trim()) return errorResponse('Evaluation input is required.')
    const [run] = await scopedRepo(evaluationRuns).system().findMany({ where: eq(evaluationRuns.id, body.evaluationRunId), limit: 1 })
    let evaluationRunId = body.evaluationRunId
    if (!run) {
      if (body.evaluationRunId !== 'illustrative-run') return errorResponse('Evaluation run not found.', 404)
      const [createdRun] = await scopedRepo(evaluationRuns).system().insert({ name: 'Illustrative Judge case', status: 'illustrative', started_at: new Date(), summary: { dataset_status: 'not registered', source: 'manual illustrative case' } })
      if (!createdRun) return errorResponse('Illustrative evaluation run could not be created.')
      evaluationRunId = createdRun.id
    }
    const [row] = await scopedRepo(evaluationCases).system().insert({ evaluation_run_id: evaluationRunId, input_text: body.inputText.trim().slice(0, 12000), expected_output: typeof body.expectedOutput === 'string' ? body.expectedOutput.slice(0, 12000) : null, actual_output: typeof body.actualOutput === 'string' ? body.actualOutput.slice(0, 12000) : null, passed: typeof body.passed === 'boolean' ? body.passed : null, evaluation_notes: typeof body.evaluationNotes === 'string' ? body.evaluationNotes.slice(0, 5000) : null })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Evaluation case could not be saved.')
  }
})
