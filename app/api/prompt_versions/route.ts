import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { promptVersions } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async () => {
  try {
    const rows = await scopedRepo(promptVersions).system().findMany({ orderBy: desc(promptVersions.id) })
    return Response.json({ success: true, data: rows })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Prompt versions could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.versionLabel !== 'string' || !body.versionLabel.trim()) return errorResponse('Version label is required.')
    if (typeof body?.promptText !== 'string' || !body.promptText.trim()) return errorResponse('Prompt text is required.')
    const [row] = await scopedRepo(promptVersions).system().insert({ version_label: body.versionLabel.trim().slice(0, 120), prompt_text: body.promptText.trim().slice(0, 30000), is_active: body.isActive === true, notes: typeof body.notes === 'string' ? body.notes.slice(0, 5000) : null })
    return Response.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Prompt version could not be created.')
  }
})

export const PUT = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    if (typeof body?.id !== 'string' || !body.id) return errorResponse('Prompt version id is required.')
    const updates: Record<string, string | boolean | null> = {}
    if (typeof body.versionLabel === 'string' && body.versionLabel.trim()) updates.version_label = body.versionLabel.trim().slice(0, 120)
    if (typeof body.promptText === 'string' && body.promptText.trim()) updates.prompt_text = body.promptText.trim().slice(0, 30000)
    if (typeof body.isActive === 'boolean') updates.is_active = body.isActive
    if (typeof body.notes === 'string') updates.notes = body.notes.slice(0, 5000)
    const [row] = await scopedRepo(promptVersions).system().update(eq(promptVersions.id, body.id), updates)
    if (!row) return errorResponse('Prompt version not found.', 404)
    return Response.json({ success: true, data: row })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Prompt version could not be updated.')
  }
})
