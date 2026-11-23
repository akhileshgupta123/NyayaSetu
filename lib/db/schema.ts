export { users } from 'lyzr-architect-pg/schema'
import {
  boolean,
  generateId,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  ownerUserId,
} from 'lyzr-architect-pg/schema'

export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey().$defaultFn(generateId),
  role: text('role').notNull().default('consumer'),
  display_name: text('display_name'),
  consent_given_at: timestamp('consent_given_at', { withTimezone: true }),
  consent_version: text('consent_version'),
  preferred_language: text('preferred_language').default('en'),
  owner_user_id: ownerUserId(),
}, (table) => [index('user_profiles_owner_idx').on(table.owner_user_id)])

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().$defaultFn(generateId),
  title: text('title').notNull().default('Untitled conversation'),
  status: text('status').notNull().default('open'),
  reopened_at: timestamp('reopened_at', { withTimezone: true }),
  exported_at: timestamp('exported_at', { withTimezone: true }),
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
  owner_user_id: ownerUserId(),
}, (table) => [index('conversations_owner_idx').on(table.owner_user_id)])

export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(generateId),
  conversation_id: text('conversation_id').notNull().references(() => conversations.id),
  sequence_number: integer('sequence_number').notNull().default(0),
  role: text('role').notNull().default('user'),
  original_text: text('original_text').notNull(),
  redacted_text: text('redacted_text'),
  contains_pii: boolean('contains_pii').notNull().default(false),
  owner_user_id: ownerUserId(),
}, (table) => [index('messages_owner_idx').on(table.owner_user_id), index('messages_conversation_idx').on(table.conversation_id)])

export const promptVersions = pgTable('prompt_versions', {
  id: text('id').primaryKey().$defaultFn(generateId),
  version_label: text('version_label').notNull(),
  prompt_text: text('prompt_text').notNull(),
  is_active: boolean('is_active').notNull().default(false),
  notes: text('notes'),
})

export const answers = pgTable('answers', {
  id: text('id').primaryKey().$defaultFn(generateId),
  message_id: text('message_id').notNull().references(() => messages.id),
  answer_text: text('answer_text').notNull(),
  is_grounded: boolean('is_grounded').notNull().default(false),
  confidence_score: real('confidence_score'),
  prompt_version_id: text('prompt_version_id').references(() => promptVersions.id),
  owner_user_id: ownerUserId(),
}, (table) => [index('answers_owner_idx').on(table.owner_user_id), index('answers_message_idx').on(table.message_id)])

export const citations = pgTable('citations', {
  id: text('id').primaryKey().$defaultFn(generateId),
  answer_id: text('answer_id').notNull().references(() => answers.id),
  source_title: text('source_title').notNull(),
  source_url: text('source_url'),
  excerpt: text('excerpt'),
  rank: integer('rank').notNull().default(0),
  owner_user_id: ownerUserId(),
}, (table) => [index('citations_owner_idx').on(table.owner_user_id), index('citations_answer_idx').on(table.answer_id)])

export const jurisdictionResults = pgTable('jurisdiction_results', {
  id: text('id').primaryKey().$defaultFn(generateId),
  conversation_id: text('conversation_id').notNull().references(() => conversations.id),
  message_id: text('message_id').references(() => messages.id),
  state: text('state'),
  district: text('district'),
  forum_type: text('forum_type'),
  determined_at: timestamp('determined_at', { withTimezone: true }),
  determination_basis: jsonb('determination_basis'),
  owner_user_id: ownerUserId(),
}, (table) => [index('jurisdiction_results_owner_idx').on(table.owner_user_id), index('jurisdiction_results_conversation_idx').on(table.conversation_id)])

export const evaluationRuns = pgTable('evaluation_runs', {
  id: text('id').primaryKey().$defaultFn(generateId),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  prompt_version_id: text('prompt_version_id').references(() => promptVersions.id),
  started_at: timestamp('started_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  summary: jsonb('summary'),
})

export const evaluationCases = pgTable('evaluation_cases', {
  id: text('id').primaryKey().$defaultFn(generateId),
  evaluation_run_id: text('evaluation_run_id').notNull().references(() => evaluationRuns.id),
  input_text: text('input_text').notNull(),
  expected_output: text('expected_output'),
  actual_output: text('actual_output'),
  passed: boolean('passed'),
  evaluation_notes: text('evaluation_notes'),
})

export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey().$defaultFn(generateId),
  event_type: text('event_type').notNull(),
  event_data: jsonb('event_data').default({}),
  is_redacted: boolean('is_redacted').notNull().default(true),
  related_conversation_id: text('related_conversation_id').references(() => conversations.id),
  owner_user_id: ownerUserId(),
}, (table) => [index('audit_events_owner_idx').on(table.owner_user_id)])
