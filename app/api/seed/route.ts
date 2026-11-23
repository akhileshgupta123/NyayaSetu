import { authMiddleware, scopedRepo } from 'lyzr-architect-pg'
import { conversations, messages } from '@/lib/db/schema'

function errorResponse(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status })
}

const starterRecords = [
  {
    title: 'Defective refrigerator',
    question: 'I purchased a refrigerator for ₹78,000 in January. It stopped cooling after three weeks, and the seller refused replacement after two service visits.',
  },
  {
    title: 'Airline refund delay',
    question: 'An airline cancelled my domestic booking, but the refund has not arrived after the promised processing period. What records should I keep before escalating?',
  },
  {
    title: 'Insurance service issue',
    question: 'My health insurer rejected a cashless request without a clear reason and has not answered my written complaint. What procedural information should I gather?',
  },
  {
    title: 'Online course representation',
    question: 'An online course advertised live mentoring and a placement service, but the delivered service was materially different. How can I organize the issue for consumer guidance?',
  },
]

export const POST = authMiddleware(async () => {
  try {
    const conversationRepo = scopedRepo(conversations)
    const existingConversations = await conversationRepo.count()
    if (existingConversations === 0) {
      for (const [index, starter] of starterRecords.entries()) {
        const [conversation] = await conversationRepo.insert({ title: starter.title, status: 'open' })
        if (conversation?.id) {
          await scopedRepo(messages).insert({ conversation_id: conversation.id, sequence_number: 0, role: 'user', original_text: starter.question, redacted_text: starter.question, contains_pii: false })
          if (index === 0) {
            await scopedRepo(messages).insert({ conversation_id: conversation.id, sequence_number: 1, role: 'system', original_text: 'Starter example — review the redaction preview before sending a new question.', redacted_text: 'Starter example — review the redaction preview before sending a new question.', contains_pii: false })
          }
        }
      }
    }
    return Response.json({ success: true, seeded: existingConversations === 0, count: existingConversations === 0 ? starterRecords.length : existingConversations })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Starter records could not be created.')
  }
})
