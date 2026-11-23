import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

export const GET = authMiddleware(async () => {
  try {
    const [profile] = await scopedRepo(userProfiles).findMany({ limit: 1 })
    return Response.json({ success: true, data: profile ?? null })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Profile could not be loaded.')
  }
})

export const POST = authMiddleware(async (request) => {
  try {
    const body = await request.json()
    const repo = scopedRepo(userProfiles)
    const [existing] = await repo.findMany({ limit: 1 })
    const values = { role: typeof body?.role === 'string' ? body.role.slice(0, 40) : 'consumer', display_name: typeof body?.displayName === 'string' ? body.displayName.slice(0, 160) : null, consent_given_at: body?.consentGiven === true ? new Date() : null, consent_version: typeof body?.consentVersion === 'string' ? body.consentVersion.slice(0, 40) : null, preferred_language: typeof body?.preferredLanguage === 'string' ? body.preferredLanguage.slice(0, 16) : 'en' }
    const [profile] = existing ? await repo.update(eq(userProfiles.id, existing.id), values) : await repo.insert(values)
    return Response.json({ success: true, data: profile }, { status: existing ? 200 : 201 })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Profile could not be saved.')
  }
})
