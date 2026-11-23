'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  FlaskConical,
  Gavel,
  History,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Play,
  RefreshCw,
  Save,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Toaster, toast } from 'sonner'
import {
  AuthProvider,
  LoginForm,
  ProtectedRoute,
  RegisterForm,
  UserMenu,
  useAuth,
} from 'lyzr-architect-pg/client'

const MANAGER_AGENT_ID = '6b03eed24fdf4fe1ecb86043'
const RESEARCH_AGENT_ID = '6b03ee884fdf4fe1ecb86036'
const BUILDER_AGENT_ID = '6b03ee9dfa1816d91a00d8b6'
const JUDGE_AGENT_ID = '6b03eeaffa1816d91a00d8bc'

const SAMPLE_QUESTION = 'I purchased a refrigerator for ₹78,000 in January. It stopped cooling after three weeks, and the seller refused replacement after two service visits.'
const SAMPLE_CATEGORY = 'Defective product'
const SAMPLE_AMOUNT = '78000'
const SAMPLE_COMPENSATION = '25000'

const AGENTS = [
  { id: MANAGER_AGENT_ID, name: 'NyayaSetu Orchestrator', purpose: 'Classifies, safeguards, and assembles grounded guidance.' },
  { id: RESEARCH_AGENT_ID, name: 'Consumer Law Research', purpose: 'Finds and validates approved legal evidence.' },
  { id: BUILDER_AGENT_ID, name: 'Consumer Guidance Builder', purpose: 'Turns evidence into concise procedural steps.' },
  { id: JUDGE_AGENT_ID, name: 'Evaluation Judge', purpose: 'Grades test answers against the Gold Set rubric.' },
]

type View = 'workspace' | 'answer' | 'history' | 'sources' | 'evaluation'
type Stage = 'idle' | 'scrubbing' | 'jurisdiction' | 'researching' | 'complete'

type AgentMetadata = {
  agent_name: string
  model_version: string
  redaction_confirmed: boolean
  timestamp: string
}

type Citation = {
  source_id: string
  title: string
  section: string
  document_type: 'statute' | 'rule' | 'notification' | 'judgment' | 'other'
  supported_claim: string
  excerpt: string
  rank: number
}

type Jurisdiction = {
  status: 'calculated' | 'insufficient' | 'not_applicable' | 'unavailable'
  selected_commission: string
  amount_used: string
  rule_version: string
  effective_date: string
  explanation: string
  warning: string
}

type ManagerEvaluation = {
  present: boolean
  overall_score: number
  answer_type_rationale: string
  answer_quality_rationale: string
  citation_grounding_score: number
  jurisdiction_correctness: 'correct' | 'incorrect' | 'not_applicable' | 'insufficient_reference'
  safety_status: 'pass' | 'fail' | 'not_applicable'
  failure_category: string
  failure_rationale: string
  latency_ms: number
  retrieval_configuration: string
  model_version: string
  prompt_version: string
  automated_evaluation_notice: string
}

type ManagerResult = {
  request_classification: 'consumer_guidance' | 'research_only' | 'evaluation' | 'prohibited_request' | 'insufficient_information'
  safety_decision: 'allowed' | 'refuse' | 'redirect'
  safety_reason: string
  final_answer: string
  summary: string
  procedural_steps: string[]
  missing_information: string[]
  citations: Citation[]
  jurisdiction: Jurisdiction
  limitations: string[]
  tool_status: 'not_registered' | 'available_and_used' | 'not_needed' | 'failed'
  fallback_used: boolean
  sub_agents_used: string[]
  evaluation: ManagerEvaluation
}

type ResearchEvidence = {
  rank: number
  source_id: string
  title: string
  section: string
  document_type: 'statute' | 'rule' | 'notification' | 'judgment' | 'other'
  excerpt: string
  lexical_score: number
  dense_score: number
  fused_score: number
  rerank_score: number
  relevance_validated: boolean
  validation_note: string
}

type ResearchResult = {
  normalized_question: string
  retrieval_queries: string[]
  exact_legal_references: string[]
  evidence: ResearchEvidence[]
  evidence_quality: 'strong' | 'mixed' | 'weak' | 'none' | 'contradictory'
  tool_status: 'available_and_used' | 'not_registered' | 'not_needed' | 'failed'
  fallback_used: boolean
  fallback_reason: string
  limitations: string[]
}

type BuilderResult = {
  direct_answer: string
  procedural_steps: string[]
  jurisdiction: Jurisdiction
  citations: Citation[]
  missing_information: string[]
  limitations: string[]
  safety_decision: 'allowed' | 'refuse' | 'redirect'
  refusal_category: 'none' | 'legal_drafting' | 'outcome_prediction' | 'impersonation' | 'fabricated_evidence' | 'harassment_or_threat' | 'other'
  evidence_status: 'approved_and_sufficient' | 'approved_but_limited' | 'contradictory' | 'unavailable'
  fallback_used: boolean
  auditable_rationale: string
}

type JudgeResult = {
  overall_score: number
  answer_type_rationale: string
  answer_quality_rationale: string
  citation_grounding_score: number
  citation_grounding_rationale: string
  jurisdiction_correctness: 'correct' | 'incorrect' | 'not_applicable' | 'insufficient_reference'
  jurisdiction_rationale: string
  safety_status: 'pass' | 'fail' | 'not_applicable'
  safety_rationale: string
  failure_category: string
  failure_rationale: string
  latency_ms: number
  retrieval_configuration: string
  model_version: string
  prompt_version: string
  automated_evaluation_notice: string
}

type Conversation = {
  id: string
  title: string
  status: string
  reopened_at?: string | null
  exported_at?: string | null
  deleted_at?: string | null
}

type SavedMessage = {
  id: string
  conversation_id: string
  sequence_number: number
  role: string
  original_text: string
  redacted_text?: string | null
  contains_pii: boolean
}

type SavedAnswer = {
  id: string
  message_id: string
  answer_text: string
  is_grounded: boolean
  confidence_score?: number | null
  prompt_version_id?: string | null
}

type ServerJurisdiction = {
  state?: string | null
  district?: string | null
  forum_type?: string | null
  determined_at?: string | null
  determination_basis?: Record<string, unknown> | null
}

type EvaluationRun = {
  id: string
  name: string
  status: string
  prompt_version_id?: string | null
  started_at?: string | null
  completed_at?: string | null
  summary?: Record<string, unknown> | null
}

type EvaluationCase = {
  id: string
  evaluation_run_id: string
  input_text: string
  expected_output?: string | null
  actual_output?: string | null
  passed?: boolean | null
  evaluation_notes?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isAgentMetadata(value: unknown): value is AgentMetadata {
  if (!isRecord(value)) return false
  return isString(value.agent_name) && isString(value.model_version) && isString(value.timestamp) && typeof value.redaction_confirmed === 'boolean'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isJurisdiction(value: unknown): value is Jurisdiction {
  if (!isRecord(value)) return false
  return isString(value.status) && isString(value.selected_commission) && isString(value.amount_used) && isString(value.rule_version) && isString(value.effective_date) && isString(value.explanation) && isString(value.warning)
}

function isCitation(value: unknown): value is Citation {
  if (!isRecord(value)) return false
  return isString(value.source_id) && isString(value.title) && isString(value.section) && isString(value.document_type) && isString(value.supported_claim) && isString(value.excerpt) && isNumber(value.rank)
}

function isCitationArray(value: unknown): value is Citation[] {
  return Array.isArray(value) && value.every(isCitation)
}

function isManagerEvaluation(value: unknown): value is ManagerEvaluation {
  if (!isRecord(value)) return false
  return typeof value.present === 'boolean' && isNumber(value.overall_score) && isString(value.answer_type_rationale) && isString(value.answer_quality_rationale) && isNumber(value.citation_grounding_score) && isString(value.jurisdiction_correctness) && isString(value.safety_status) && isString(value.failure_category) && isString(value.failure_rationale) && isNumber(value.latency_ms) && isString(value.retrieval_configuration) && isString(value.model_version) && isString(value.prompt_version) && isString(value.automated_evaluation_notice)
}

function isManagerResult(value: unknown): value is ManagerResult {
  if (!isRecord(value)) return false
  return isString(value.request_classification) && isString(value.safety_decision) && isString(value.safety_reason) && isString(value.final_answer) && isString(value.summary) && isStringArray(value.procedural_steps) && isStringArray(value.missing_information) && isCitationArray(value.citations) && isJurisdiction(value.jurisdiction) && isStringArray(value.limitations) && isString(value.tool_status) && typeof value.fallback_used === 'boolean' && isStringArray(value.sub_agents_used) && isManagerEvaluation(value.evaluation)
}

function isResearchEvidence(value: unknown): value is ResearchEvidence {
  if (!isRecord(value)) return false
  return isNumber(value.rank) && isString(value.source_id) && isString(value.title) && isString(value.section) && isString(value.document_type) && isString(value.excerpt) && isNumber(value.lexical_score) && isNumber(value.dense_score) && isNumber(value.fused_score) && isNumber(value.rerank_score) && typeof value.relevance_validated === 'boolean' && isString(value.validation_note)
}

function isResearchResult(value: unknown): value is ResearchResult {
  if (!isRecord(value)) return false
  return isString(value.normalized_question) && isStringArray(value.retrieval_queries) && isStringArray(value.exact_legal_references) && Array.isArray(value.evidence) && value.evidence.every(isResearchEvidence) && isString(value.evidence_quality) && isString(value.tool_status) && typeof value.fallback_used === 'boolean' && isString(value.fallback_reason) && isStringArray(value.limitations)
}

function isBuilderResult(value: unknown): value is BuilderResult {
  if (!isRecord(value)) return false
  return isString(value.direct_answer) && isStringArray(value.procedural_steps) && isJurisdiction(value.jurisdiction) && isCitationArray(value.citations) && isStringArray(value.missing_information) && isStringArray(value.limitations) && isString(value.safety_decision) && isString(value.refusal_category) && isString(value.evidence_status) && typeof value.fallback_used === 'boolean' && isString(value.auditable_rationale)
}

function isJudgeResult(value: unknown): value is JudgeResult {
  if (!isRecord(value)) return false
  return isNumber(value.overall_score) && isString(value.answer_type_rationale) && isString(value.answer_quality_rationale) && isNumber(value.citation_grounding_score) && isString(value.citation_grounding_rationale) && isString(value.jurisdiction_correctness) && isString(value.jurisdiction_rationale) && isString(value.safety_status) && isString(value.safety_rationale) && isString(value.failure_category) && isString(value.failure_rationale) && isNumber(value.latency_ms) && isString(value.retrieval_configuration) && isString(value.model_version) && isString(value.prompt_version) && isString(value.automated_evaluation_notice)
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2 text-pretty">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="mt-3 text-sm font-semibold">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="mt-3 text-base font-semibold">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="mt-4 text-lg font-bold">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-6">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function scrubText(text: string) {
  let redacted = text
  const removed: string[] = []
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  const phonePattern = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g
  const accountPattern = /\b\d{12,16}\b/g
  if (emailPattern.test(redacted)) removed.push('email address')
  redacted = redacted.replace(emailPattern, '[EMAIL REDACTED]')
  if (phonePattern.test(redacted)) removed.push('phone number')
  redacted = redacted.replace(phonePattern, '[PHONE REDACTED]')
  if (accountPattern.test(redacted)) removed.push('account-like number')
  redacted = redacted.replace(accountPattern, '[IDENTIFIER REDACTED]')
  return { redacted, removed, containsPii: redacted !== text }
}

function parseAmount(value: string) {
  const numeric = Number(value.replace(/[^0-9.]/g, ''))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

function calculateJurisdictionPreview(amountText: string): Jurisdiction {
  const amount = parseAmount(amountText)
  if (!amount) {
    return {
      status: 'insufficient',
      selected_commission: 'Not determined',
      amount_used: 'Not provided',
      rule_version: '2021 configuration preview',
      effective_date: 'Not verified in this environment',
      explanation: 'Enter the consideration value paid for the goods or services to calculate a commission preview.',
      warning: 'The local legal service is not registered; verify the active rule against the official notification before filing.',
    }
  }
  const selected = amount <= 5000000 ? 'District Consumer Disputes Redressal Commission' : amount <= 20000000 ? 'State Consumer Disputes Redressal Commission' : 'National Consumer Disputes Redressal Commission'
  return {
    status: 'calculated',
    selected_commission: selected,
    amount_used: formatINR(amount),
    rule_version: '2021 configuration preview',
    effective_date: 'Not verified in this environment',
    explanation: `The preview compares ${formatINR(amount)} with the configured consideration-value bands.`,
    warning: 'This deterministic preview is not a substitute for checking the current official jurisdiction notification.',
  }
}

function statusClass(status: string) {
  if (status === 'pass' || status === 'allowed' || status === 'calculated' || status === 'strong' || status === 'approved_and_sufficient') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'refuse' || status === 'fail' || status === 'contradictory' || status === 'unavailable') return 'text-destructive'
  return 'text-primary'
}

function managerEvidenceStatus(data: ManagerResult) {
  if (data.tool_status === 'available_and_used' && !data.fallback_used) return 'approved_and_sufficient'
  if (data.tool_status === 'failed') return 'unavailable'
  return 'approved_but_limited'
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [disclosureAccepted, setDisclosureAccepted] = useState(false)
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[1.08fr_.92fr]">
      <section className="flex min-h-[520px] flex-col justify-between bg-foreground px-6 py-8 text-background sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
        <div className="flex items-center gap-3 text-lg font-bold tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/40 text-sm text-primary">न्या</span>
          NyayaSetu
        </div>
        <div className="max-w-2xl py-12 lg:py-0">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" /> Indian consumer-rights copilot
          </Badge>
          <h1 className="mt-6 max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            A clearer path through <span className="italic text-primary">consumer grievance procedures.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-background/70 sm:text-lg">Research applicable consumer-law sources, understand jurisdiction, and organize your next procedural steps.</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            {[
              ['Grounded research', 'Answers are separated from approved source excerpts.'],
              ['Deterministic jurisdiction', 'Commission selection is calculated outside the model.'],
              ['PII redaction', 'Contact details are scrubbed before hosted processing.'],
              ['Clear boundaries', 'Information only, never legal representation or outcome prediction.'],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl border border-background/15 bg-background/5 p-4">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-background/60">{description}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="max-w-lg text-xs leading-5 text-background/55">Hosted AI receives only your locally redacted question. NyayaSetu does not provide legal representation or predict case outcomes.</p>
      </section>
      <section className="flex items-center justify-center bg-muted/30 px-5 py-10 sm:px-10 lg:px-12">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8">
          <div className="mb-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{mode === 'login' ? 'Welcome back' : 'Create workspace'}</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight">{mode === 'login' ? 'Sign in securely' : 'Start your research workspace'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === 'login' ? 'Access saved questions, grounded answers, and evaluation work.' : 'Your conversations remain scoped to your account.'}</p>
          </div>
          {disclosureAccepted ? (mode === 'login' ? <LoginForm onSwitchToRegister={() => { setMode('register'); setDisclosureAccepted(false) }} /> : <RegisterForm onSwitchToLogin={() => { setMode('login'); setDisclosureAccepted(false) }} />) : <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Review before you continue</p><p className="mt-1 text-xs leading-5 text-muted-foreground">NyayaSetu provides legal information, not representation. Questions are locally redacted and then processed by hosted AI. Never enter unnecessary names, phone numbers, addresses, or account identifiers.</p></div></div><div className="flex items-start gap-3"><Checkbox id="auth-disclosure" checked={disclosureAccepted} onCheckedChange={(checked) => setDisclosureAccepted(checked === true)} className="mt-0.5" /><Label htmlFor="auth-disclosure" className="cursor-pointer text-xs leading-5">I understand the legal-information and hosted-processing disclosures.</Label></div><Button type="button" disabled={!disclosureAccepted} onClick={() => undefined} className="w-full">Continue to {mode === 'login' ? 'sign in' : 'create an account'} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>}
          <div className="mt-7 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>By continuing, you acknowledge the legal-information boundary and hosted-processing disclosure. Do not enter unnecessary personal details.</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-xs font-bold text-primary">न्या</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold tracking-tight">NyayaSetu</p>
        <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Consumer-rights research workspace</p>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const saved = window.localStorage.getItem('theme')
    const nextTheme = saved === 'light' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }, [])
  const toggle = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    window.localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }
  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="h-10 w-10 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function AgentStatusStrip({ activeAgentId }: { activeAgentId: string | null }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Powering agents</p>
        <Activity className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="space-y-2">
        {AGENTS.map((agent) => {
          const active = activeAgentId === agent.id
          return (
            <div key={agent.id} className="flex min-w-0 items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'animate-pulse bg-primary' : 'bg-muted-foreground/40'}`} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">{agent.name}</p>
                <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">{active ? 'Working on this request…' : agent.purpose}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StagePills({ stage }: { stage: Stage }) {
  const steps = [
    ['describe', 'Describe'],
    ['review', 'Review redaction'],
    ['research', 'Research'],
    ['guidance', 'Guidance'],
  ] as const
  const index = stage === 'scrubbing' ? 1 : stage === 'jurisdiction' || stage === 'researching' ? 2 : stage === 'complete' ? 3 : 0
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {steps.map(([key, label], stepIndex) => (
        <div key={key} className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 ${stepIndex <= index ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted/40'}`}>{stepIndex + 1} {label}</span>
          {stepIndex < steps.length - 1 && <span className="hidden text-border sm:inline">—</span>}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof FileText; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed bg-card/60 shadow-none">
      <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
        <h3 className="mt-4 text-base font-semibold">{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  )
}

function PrivacyPreview({ text, compact = false }: { text: string; compact?: boolean }) {
  const result = useMemo(() => scrubText(text), [text])
  return (
    <div className={`rounded-xl border ${result.containsPii ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'} p-4`}>
      <div className="flex items-start gap-3">
        {result.containsPii ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{result.containsPii ? 'Redaction required' : 'Privacy check passed'}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{result.containsPii ? `${result.removed.join(', ')} will be removed before hosted processing.` : 'No email, phone number, or account-like identifier detected.'}</p>
          {!compact ? <p className="mt-3 break-words rounded-lg border border-border/70 bg-background/70 p-3 text-xs leading-5 text-foreground">{result.redacted || 'Add a question to preview the redacted text.'}</p> : null}
          {result.containsPii ? <div className="mt-2 flex flex-wrap gap-1.5">{result.removed.map((label) => <Badge key={label} variant="outline" className="border-primary/30 text-[10px] text-primary">{label} removed</Badge>)}</div> : null}
        </div>
      </div>
    </div>
  )
}

function JurisdictionCard({ jurisdiction, serverResult, authoritative = true }: { jurisdiction: Jurisdiction; serverResult?: ServerJurisdiction | null; authoritative?: boolean }) {
  const selected = serverResult?.forum_type || serverResult?.district || serverResult?.state || jurisdiction.selected_commission
  const amount = jurisdiction.amount_used
  return (
    <Card className={`${authoritative ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'} shadow-sm`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">{authoritative ? 'Application-calculated result' : 'Agent-reported field'}</p>
            <CardTitle className="mt-2 text-xl leading-tight">{selected || 'Commission not determined'}</CardTitle>
          </div>
          <Scale className="h-5 w-5 shrink-0 text-primary" />
        </div>
        <CardDescription className="leading-5">{authoritative ? 'The application calculator is kept outside the language model. Any rule-verification limitation stays visible.' : 'Shown for contract transparency only; this field is not used to calculate the application jurisdiction.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/70 bg-background/60 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</p><p className={`mt-1 text-sm font-semibold ${statusClass(jurisdiction.status)}`}>{jurisdiction.status}</p></div>
          <div className="rounded-lg border border-border/70 bg-background/60 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Amount used</p><p className="mt-1 text-sm font-semibold tabular-nums">{amount}</p></div>
          <div className="rounded-lg border border-border/70 bg-background/60 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rule version</p><p className="mt-1 text-sm font-semibold">{jurisdiction.rule_version}</p></div>
        </div>
        <MetricRow label="Effective date" value={jurisdiction.effective_date} />
        <div className="text-sm leading-6 text-muted-foreground">{renderMarkdown(jurisdiction.explanation)}</div>
        {jurisdiction.warning ? <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/10 p-3 text-xs leading-5 text-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{jurisdiction.warning}</span></div> : null}
      </CardContent>
    </Card>
  )
}

function CitationCard({ citation, score, verified = true }: { citation: Citation; score?: ResearchEvidence; verified?: boolean }) {
  return (
    <div className="rounded-xl border border-border/80 bg-background/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{citation.title}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">{citation.document_type} · {citation.section} · rank {citation.rank}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">{verified ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Verified posture</Badge> : <Badge variant="outline" className="border-primary/40 text-primary">Not verified</Badge>}{score ? <Badge variant="outline" className="tabular-nums">rerank {score.rerank_score.toFixed(2)}</Badge> : null}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{citation.supported_claim}</p>
      <blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-sm leading-6 text-foreground/85">{citation.excerpt}</blockquote>
      <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">Source ID: {citation.source_id}</p>
      {score ? <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground sm:grid-cols-4"><span>lexical {score.lexical_score.toFixed(2)}</span><span>dense {score.dense_score.toFixed(2)}</span><span>fused {score.fused_score.toFixed(2)}</span><span>{score.relevance_validated ? 'validated' : 'unvalidated'}</span></div> : null}
    </div>
  )
}

function MetricRow({ label, value, note, tone = 'neutral' }: { label: string; value: string; note?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const toneClass = tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-primary' : 'text-foreground'
  return <div className="flex items-start justify-between gap-4 border-b border-border/70 py-3 last:border-b-0"><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p>{note ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{note}</p> : null}</div><p className={`shrink-0 text-right text-sm font-semibold ${toneClass}`}>{value}</p></div>
}

function LoadingBlock({ label }: { label: string }) {
  return <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-primary"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div>
}

async function readApiResponse(response: Response) {
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !isRecord(payload) || payload.success !== true) {
    const error = isRecord(payload) && isString(payload.error) ? payload.error : 'The requested record could not be saved.'
    throw new Error(error)
  }
  return payload
}

function AnswerWorkspace({
  data,
  metadata,
  serverJurisdiction,
  onBack,
  onCopy,
  onExport,
  responseStatus,
  responseMessage,
  deterministicJurisdiction,
}: {
  data: ManagerResult
  metadata: AgentMetadata | null
  serverJurisdiction: ServerJurisdiction | null
  onBack: () => void
  onCopy: () => void
  onExport: () => void
  responseStatus: string
  responseMessage: string
  deterministicJurisdiction: Jurisdiction
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button type="button" variant="ghost" onClick={onBack} className="-ml-3 mb-3 h-9 px-3 text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back to workspace</Button>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Grounded answer · {data.request_classification.replaceAll('_', ' ')}</p>
          <h1 className="mt-2 max-w-3xl text-balance font-serif text-3xl tracking-tight sm:text-4xl">{data.safety_decision === 'allowed' ? 'A procedural path, with its limits visible.' : 'A safe boundary for this request.'}</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-6 text-muted-foreground">{data.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`${managerEvidenceStatus(data) === 'approved_and_sufficient' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-primary/40 text-primary'}`}><span className="mr-2 h-1.5 w-1.5 rounded-full bg-current" /> {managerEvidenceStatus(data).replaceAll('_', ' ')}</Badge>
          <Button type="button" variant="outline" onClick={onCopy} className="h-10"><Copy className="mr-2 h-4 w-4" /> Copy</Button>
          <Button type="button" variant="outline" onClick={onExport} className="h-10"><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>

      {data.safety_decision !== 'allowed' ? <Card className="border-primary/40 bg-primary/5"><CardContent className="flex items-start gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">This request was {data.safety_decision}.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{data.safety_reason}</p><p className="mt-2 text-xs font-medium text-primary">Refusal category: {data.evaluation.failure_category === 'none' ? 'boundary check' : data.evaluation.failure_category.replaceAll('_', ' ')}</p></div></CardContent></Card> : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border/70 bg-muted/20 pb-4"><CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="h-5 w-5 text-primary" /> Direct answer</CardTitle><CardDescription>Model synthesis is separate from the supporting excerpts below.</CardDescription></CardHeader>
            <CardContent className="p-5 sm:p-7"><div className="font-serif text-base leading-8 text-foreground/90">{renderMarkdown(data.final_answer)}</div></CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><ListChecks className="h-5 w-5 text-primary" /> Recommended next steps</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {data.procedural_steps.length > 0 ? data.procedural_steps.map((step, index) => <div key={`${step}-${index}`} className="flex gap-3 border-b border-border/70 py-4 last:border-b-0"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><div className="text-sm leading-6">{renderMarkdown(step)}</div></div>) : <p className="text-sm text-muted-foreground">No procedural steps were returned.</p>}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-lg">Missing information</CardTitle><CardDescription>These gaps can change the usefulness of the guidance.</CardDescription></CardHeader>
            <CardContent>{data.missing_information.length > 0 ? <ul className="space-y-2">{data.missing_information.map((item) => <li key={item} className="flex gap-2 text-sm leading-6"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul> : <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> No additional missing information was reported.</div>}</CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-lg">{data.tool_status === 'available_and_used' && !data.fallback_used ? 'Supporting sources' : 'Agent-reported references'}</CardTitle><CardDescription>{data.tool_status === 'available_and_used' && !data.fallback_used ? 'Inspect the claims the builder associated with each returned passage.' : 'These references were returned by the agent but are not treated as retrieved or verified because the local legal-service tool is unavailable.'}</CardDescription></CardHeader>
            <CardContent className="space-y-3">{data.citations.length > 0 ? data.citations.map((citation) => <CitationCard key={`${citation.source_id}-${citation.rank}`} citation={citation} verified={data.tool_status === 'available_and_used' && !data.fallback_used} />) : <EmptyState icon={FileSearch} title="No citations returned" description="The local legal corpus tool is not registered in this environment. NyayaSetu will not invent a source or citation." />}</CardContent>
          </Card>
        </section>

        <aside className="min-w-0 space-y-5">
          <JurisdictionCard jurisdiction={deterministicJurisdiction} serverResult={serverJurisdiction} />
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-lg">Evidence posture</CardTitle><CardDescription>Tool availability and safety stay explicit.</CardDescription></CardHeader>
            <CardContent><MetricRow label="Evidence status" value={managerEvidenceStatus(data).replaceAll('_', ' ')} tone={managerEvidenceStatus(data) === 'approved_and_sufficient' ? 'good' : 'warn'} /><MetricRow label="Tool status" value={data.tool_status.replaceAll('_', ' ')} tone={data.tool_status === 'available_and_used' ? 'good' : 'warn'} /><MetricRow label="Fallback used" value={data.fallback_used ? 'Yes' : 'No'} tone={data.fallback_used ? 'warn' : 'good'} /><div className="border-b border-border/70 py-3"><p className="text-xs text-muted-foreground">Sub-agents used</p><div className="mt-2 flex flex-wrap gap-1.5">{data.sub_agents_used.length ? data.sub_agents_used.map((agent) => <Badge key={agent} variant="outline" className="text-[10px]">{agent}</Badge>) : <span className="text-sm font-semibold">None recorded</span>}</div></div></CardContent>
          </Card>
          <Card className="border-primary/25 bg-primary/5 shadow-sm"><CardContent className="p-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Information only</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{data.limitations.length > 0 ? data.limitations.join(' ') : 'NyayaSetu cannot draft filing-ready documents, impersonate an advocate, or predict an outcome.'}</p></div></div></CardContent></Card>
          <details className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold">Processing details</summary>
            <div className="mt-4 space-y-4 text-xs leading-5">
              <MetricRow label="Safety decision" value={data.safety_decision} />
              <MetricRow label="Refusal category" value={data.refusal_category} />
              <MetricRow label="Safety reason" value={data.safety_reason} />
              <MetricRow label="Refusal category" value={data.evaluation.failure_category} />
              <MetricRow label="Manager agent" value={metadata?.agent_name ?? 'Not returned'} />
              <MetricRow label="Manager model" value={metadata?.model_version ?? 'Not returned'} />
              <MetricRow label="Redaction confirmed" value={metadata?.redaction_confirmed ? 'Yes' : 'Not confirmed'} tone={metadata?.redaction_confirmed ? 'good' : 'warn'} />
              <MetricRow label="Manager timestamp" value={metadata?.timestamp ?? 'Not returned'} />
              <MetricRow label="Response status" value={responseStatus} />
              <MetricRow label="Response message" value={responseMessage} />
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Agent-reported jurisdiction field</p><div className="mt-2 space-y-2"><MetricRow label="Status" value={data.jurisdiction.status} /><MetricRow label="Selected commission" value={data.jurisdiction.selected_commission} /><MetricRow label="Amount used" value={data.jurisdiction.amount_used} /><MetricRow label="Rule version" value={data.jurisdiction.rule_version} /><MetricRow label="Effective date" value={data.jurisdiction.effective_date} /><MetricRow label="Explanation" value={data.jurisdiction.explanation} /><MetricRow label="Warning" value={data.jurisdiction.warning} /></div></div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Auditable rationale</p><div className="mt-2">{renderMarkdown(data.evaluation.answer_quality_rationale)}</div></div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Automated evaluation notice</p><p className="mt-2">{data.evaluation.automated_evaluation_notice}</p></div>
              <div className="grid gap-2 sm:grid-cols-2"><MetricRow label="Evaluation present" value={data.evaluation.present ? 'Yes' : 'No'} tone={data.evaluation.present ? 'good' : 'warn'} /><MetricRow label="Overall score" value={`${data.evaluation.overall_score}/5`} /><MetricRow label="Citation score" value={`${data.evaluation.citation_grounding_score}/5`} /><MetricRow label="Jurisdiction check" value={data.evaluation.jurisdiction_correctness} /><MetricRow label="Safety status" value={data.evaluation.safety_status} /></div>
              <MetricRow label="Failure category" value={data.evaluation.failure_category} /><MetricRow label="Failure rationale" value={data.evaluation.failure_rationale} /><MetricRow label="Answer type rationale" value={data.evaluation.answer_type_rationale} /><MetricRow label="Retrieval configuration" value={data.evaluation.retrieval_configuration} /><MetricRow label="Evaluation model" value={data.evaluation.model_version} /><MetricRow label="Prompt version" value={data.evaluation.prompt_version} /><MetricRow label="Latency" value={`${data.evaluation.latency_ms} ms`} />
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}

function SourceExplorer({
  activeAgentId,
  onAgentStart,
  onAgentEnd,
}: {
  activeAgentId: string | null
  onAgentStart: (id: string) => void
  onAgentEnd: () => void
}) {
  const { authFetch } = useAuth()
  const [question, setQuestion] = useState(SAMPLE_QUESTION)
  const [research, setResearch] = useState<ResearchResult | null>(null)
  const [researchMetadata, setResearchMetadata] = useState<AgentMetadata | null>(null)
  const [researchResponseStatus, setResearchResponseStatus] = useState('')
  const [researchResponseMessage, setResearchResponseMessage] = useState('')
  const [builder, setBuilder] = useState<BuilderResult | null>(null)
  const [builderMetadata, setBuilderMetadata] = useState<AgentMetadata | null>(null)
  const [builderResponseStatus, setBuilderResponseStatus] = useState('')
  const [builderResponseMessage, setBuilderResponseMessage] = useState('')
  const [loading, setLoading] = useState<'research' | 'builder' | null>(null)
  const [error, setError] = useState('')

  const runResearch = async () => {
    const redacted = scrubText(question).redacted.trim()
    if (!redacted) { setError('Add a question before running the research specialist.'); return }
    setError('')
    setLoading('research')
    onAgentStart(RESEARCH_AGENT_ID)
    try {
      const response = await authFetch('/api/local/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: redacted }) })
      const result = await response.json()
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? result.error ?? 'Research specialist failed.')
      if (!isString(result.response.message) || !isAgentMetadata(result.response.metadata)) throw new Error('The research response envelope is incomplete.')
      const payload: unknown = result.response.result
      if (!isResearchResult(payload)) throw new Error('The research response did not include the declared evidence fields.')
      setResearch(payload)
      setResearchResponseStatus(result.response.status)
      setResearchResponseMessage(result.response.message)
      setResearchMetadata(result.response.metadata)
      setBuilder(null)
      toast.success('Research specialist completed')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Research specialist failed.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(null)
      onAgentEnd()
    }
  }

  const buildGuidance = async () => {
    if (!research) return
    setError('')
    setLoading('builder')
    onAgentStart(BUILDER_AGENT_ID)
    try {
      const evidenceText = research.evidence.map((item) => `Rank ${item.rank}; ${item.title}; ${item.section}; ${item.document_type}; source ${item.source_id}; excerpt: ${item.excerpt}; rerank ${item.rerank_score}; validated ${item.relevance_validated}`).join('\n')
      const result = await callAIAgent(`Build concise procedural consumer guidance only from the supplied evidence. Do not draft a filing, predict an outcome, invent a citation, or use internal reasoning. The jurisdiction calculator was not supplied a verified local service result; explain that limitation.\n\nRedacted question:\n${research.normalized_question}\n\nEvidence quality: ${research.evidence_quality}\n\nEvidence:\n${evidenceText || 'No evidence returned.'}`, BUILDER_AGENT_ID)
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? 'Guidance builder failed.')
      if (!isString(result.response.message) || !isAgentMetadata(result.response.metadata)) throw new Error('The guidance response envelope is incomplete.')
      const payload: unknown = result.response.result
      if (!isBuilderResult(payload)) throw new Error('The guidance response did not include the declared answer fields.')
      setBuilder(payload)
      setBuilderResponseStatus(result.response.status)
      setBuilderResponseMessage(result.response.message)
      setBuilderMetadata(result.response.metadata)
      toast.success('Guidance builder completed')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Guidance builder failed.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(null)
      onAgentEnd()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Source explorer</p>
        <h1 className="mt-2 text-balance font-serif text-3xl tracking-tight sm:text-4xl">Inspect the research layer.</h1>
        <p className="mt-3 max-w-3xl text-pretty text-sm leading-6 text-muted-foreground">Run the research and guidance specialists directly when you need to inspect retrieval posture separately from the orchestrated consumer flow.</p>
      </div>
      <Card className="border-primary/30 bg-primary/5 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Local synthetic research is active</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A 2,000-record synthetic corpus drives local lexical and semantic fusion with reranking. Every passage is demonstration data, not authoritative law or expert-verified advice.</p></div></CardContent></Card>
      <Card className="shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-lg">Research query</CardTitle><CardDescription>The question is redacted and processed by the local synthetic retrieval pipeline.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="resize-y" aria-label="Research question" />
          <PrivacyPreview text={question} compact />
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{activeAgentId === RESEARCH_AGENT_ID ? 'Research agent is active…' : researchMetadata ? `Last run by ${researchMetadata.agent_name}` : 'No direct research run yet.'}</p><Button type="button" onClick={runResearch} disabled={loading !== null} className="active:scale-[0.98] transition-transform">{loading === 'research' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} Run research specialist</Button></div>
          {error ? <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
        </CardContent>
      </Card>

      {research ? <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <Card className="shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">Research response</CardTitle><CardDescription className="mt-1">Normalized query: {research.normalized_question}</CardDescription></div><Badge variant="outline" className={statusClass(research.evidence_quality)}>{research.evidence_quality} evidence</Badge></div></CardHeader><CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tool status</p><p className="mt-1 text-sm font-semibold">{research.tool_status.replaceAll('_', ' ')}</p></div><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Fallback used</p><p className="mt-1 text-sm font-semibold">{research.fallback_used ? 'Yes' : 'No'}</p></div><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Response status</p><p className="mt-1 text-sm font-semibold">{researchResponseStatus}</p></div><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Response message</p><p className="mt-1 text-sm leading-5">{researchResponseMessage}</p></div></div>
            <div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Retrieval queries</p><div className="mt-2 flex flex-wrap gap-2">{research.retrieval_queries.length ? research.retrieval_queries.map((query) => <Badge key={query} variant="secondary" className="max-w-full whitespace-normal text-left">{query}</Badge>) : <p className="text-sm text-muted-foreground">No retrieval queries returned.</p>}</div></div>
            <div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Exact legal references</p><div className="mt-2 flex flex-wrap gap-2">{research.exact_legal_references.length ? research.exact_legal_references.map((reference) => <Badge key={reference} variant="outline">{reference}</Badge>) : <p className="text-sm text-muted-foreground">No exact reference detected.</p>}</div></div>
            {research.fallback_reason ? <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm leading-6"><span className="font-semibold">Fallback reason: </span>{research.fallback_reason}</div> : null}
          </CardContent></Card>
          <Card className="shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">{research.tool_status === 'available_and_used' && !research.fallback_used ? 'Ranked evidence' : 'Agent-reported evidence'}</CardTitle><CardDescription>{research.tool_status === 'available_and_used' && !research.fallback_used ? 'Every returned evidence field is shown, including retrieval scores and validation notes.' : 'Returned fields are shown for transparency only; the local corpus tool is unavailable, so these passages and scores are not treated as verified retrieval.'}</CardDescription></div><Badge variant="outline" className={research.tool_status === 'available_and_used' && !research.fallback_used ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-primary/40 text-primary'}>{research.tool_status === 'available_and_used' && !research.fallback_used ? 'Verified retrieval' : 'Not verified'}</Badge></div></CardHeader><CardContent className="space-y-3">{research.evidence.length ? research.evidence.map((item) => <div key={`${item.source_id}-${item.rank}`} className="rounded-xl border border-border/80 bg-background/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">rank {item.rank} · {item.document_type} · {item.section}</p></div><div className="flex flex-wrap justify-end gap-2"><Badge variant="outline" className={research.tool_status === 'available_and_used' && !research.fallback_used ? 'tabular-nums' : 'border-primary/40 text-primary'}>{research.tool_status === 'available_and_used' && !research.fallback_used ? `rerank ${item.rerank_score.toFixed(3)}` : 'Agent-reported'}</Badge></div></div><blockquote className="mt-3 border-l-2 border-primary/50 pl-3 text-sm leading-6">{item.excerpt}</blockquote><p className="mt-3 text-xs leading-5 text-muted-foreground">{item.validation_note}</p><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground sm:grid-cols-5"><span>lexical {item.lexical_score.toFixed(3)}</span><span>dense {item.dense_score.toFixed(3)}</span><span>fused {item.fused_score.toFixed(3)}</span><span>validated {item.relevance_validated ? 'yes' : 'no'}</span><span className="break-all">{item.source_id}</span></div></div>) : <EmptyState icon={FileSearch} title="No evidence returned" description="No synthetic passage matched this query strongly enough to display." />}</CardContent></Card>
        </section>
        <aside className="min-w-0 space-y-5"><Card className="border-primary/30 bg-primary/5 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Build from this evidence</CardTitle><CardDescription>Ask the guidance specialist to synthesize only what this response contains.</CardDescription></CardHeader><CardContent><Button type="button" onClick={buildGuidance} disabled={loading !== null} className="w-full active:scale-[0.98] transition-transform">{loading === 'builder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Build procedural guidance</Button></CardContent></Card><Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Research limitations</CardTitle></CardHeader><CardContent className="space-y-3"><MetricRow label="Fallback reason" value={research.fallback_reason || 'None returned'} tone={research.fallback_used ? 'warn' : 'neutral'} />{research.limitations.map((item) => <div key={item} className="flex gap-2 text-xs leading-5 text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{item}</div>)}</CardContent></Card><details className="rounded-xl border border-border bg-card p-4 shadow-sm"><summary className="cursor-pointer text-sm font-semibold">Agent metadata</summary><div className="mt-4 space-y-3"><MetricRow label="Agent" value={researchMetadata?.agent_name ?? 'Not returned'} /><MetricRow label="Model" value={researchMetadata?.model_version ?? 'Not returned'} /><MetricRow label="Timestamp" value={researchMetadata?.timestamp ?? 'Not returned'} /><MetricRow label="Redaction confirmed" value={researchMetadata?.redaction_confirmed ? 'Yes' : 'Not confirmed'} /></div></details></aside>
      </div> : null}

      {builder ? <Card className="border-primary/30 shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">Direct guidance builder output</CardTitle><CardDescription>Structured output from the specialist, not a filing-ready draft.</CardDescription></div><Badge variant="outline" className={statusClass(builder.evidence_status)}>{builder.evidence_status.replaceAll('_', ' ')}</Badge></div></CardHeader><CardContent className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Response status</p><p className="mt-1 text-sm font-semibold">{builderResponseStatus}</p></div><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Response message</p><p className="mt-1 text-sm leading-5">{builderResponseMessage}</p></div></div><div className="rounded-xl border border-border bg-muted/20 p-5"><p className="font-mono text-[10px] uppercase tracking-wider text-primary">Direct answer</p><div className="mt-3">{renderMarkdown(builder.direct_answer)}</div></div><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Procedural steps</p><div className="mt-2 space-y-2">{builder.procedural_steps.map((step, index) => <div key={`${step}-${index}`} className="flex gap-2 text-sm leading-6"><span className="font-semibold text-primary">{index + 1}.</span>{step}</div>)}</div></div><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Citations</p><div className="mt-2 space-y-3">{builder.citations.length ? builder.citations.map((citation) => <CitationCard key={`${citation.source_id}-${citation.rank}`} citation={citation} verified={research.tool_status === 'available_and_used' && !research.fallback_used && research.evidence.length > 0} />) : <p className="text-sm text-muted-foreground">No citations returned.</p>}</div></div></div><div className="space-y-4"><JurisdictionCard jurisdiction={builder.jurisdiction} authoritative={false} /><MetricRow label="Safety decision" value={builder.safety_decision} tone={builder.safety_decision === 'allowed' ? 'good' : 'warn'} /><MetricRow label="Refusal category" value={builder.refusal_category} /><MetricRow label="Fallback used" value={builder.fallback_used ? 'Yes' : 'No'} tone={builder.fallback_used ? 'warn' : 'good'} /><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Auditable rationale</p><div className="mt-2">{renderMarkdown(builder.auditable_rationale)}</div></div><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Missing information</p><p className="mt-2 text-sm leading-6">{builder.missing_information.length ? builder.missing_information.join(' · ') : 'None returned'}</p></div><div><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Limitations</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{builder.limitations.length ? builder.limitations.join(' ') : 'None returned'}</p></div><details className="rounded-lg border border-border/70 p-3"><summary className="cursor-pointer text-xs font-semibold">Builder metadata</summary><div className="mt-3 space-y-2"><MetricRow label="Agent" value={builderMetadata?.agent_name ?? 'Not returned'} /><MetricRow label="Model" value={builderMetadata?.model_version ?? 'Not returned'} /><MetricRow label="Timestamp" value={builderMetadata?.timestamp ?? 'Not returned'} /><MetricRow label="Redaction confirmed" value={builderMetadata?.redaction_confirmed ? 'Yes' : 'Not confirmed'} /></div></details></div></CardContent></Card> : null}
    </div>
  )
}

function EvaluationLab({
  activeAgentId,
  onAgentStart,
  onAgentEnd,
}: {
  activeAgentId: string | null
  onAgentStart: (id: string) => void
  onAgentEnd: () => void
}) {
  const { authFetch } = useAuth()
  const [promptMode, setPromptMode] = useState('few-shot')
  const [ragEnabled, setRagEnabled] = useState(true)
  const [category, setCategory] = useState('all')
  const [runs, setRuns] = useState<EvaluationRun[]>([])
  const [cases, setCases] = useState<EvaluationCase[]>([])
  const [inputText, setInputText] = useState('Can I ask the consumer commission to consider the amount paid for a defective product?')
  const [expectedOutput, setExpectedOutput] = useState('Explain the applicable consideration-value basis and note that the official jurisdiction rule must be verified.')
  const [actualOutput, setActualOutput] = useState('The commission depends on the consideration value paid, but verify the current official notification before filing.')
  const [judge, setJudge] = useState<JudgeResult | null>(null)
  const [judgeMetadata, setJudgeMetadata] = useState<AgentMetadata | null>(null)
  const [judgeResponseStatus, setJudgeResponseStatus] = useState('')
  const [judgeResponseMessage, setJudgeResponseMessage] = useState('')
  const [loading, setLoading] = useState<'run' | 'judge' | null>(null)
  const [error, setError] = useState('')
  const [lastRunId, setLastRunId] = useState('')

  const loadRuns = useCallback(async () => {
    try {
      const response = await authFetch('/api/evaluation_runs')
      const payload = await readApiResponse(response)
      if (!Array.isArray(payload.data)) throw new Error('Evaluation run data was missing.')
      const nextRuns = payload.data.filter((item): item is EvaluationRun => isRecord(item) && isString(item.id) && isString(item.name) && isString(item.status))
      setRuns(nextRuns)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Evaluation runs could not be loaded.'
      setError(message)
    }
  }, [authFetch])

  useEffect(() => { void loadRuns() }, [loadRuns])

  const runEvaluation = async () => {
    setError('')
    setLoading('run')
    try {
      const localResponse = await authFetch('/api/local/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_mode: promptMode, rag_enabled: ragEnabled, category }) })
      const localPayload = await localResponse.json()
      if (!localPayload.success || !isRecord(localPayload.data)) throw new Error(localPayload.error ?? 'Synthetic evaluation did not return metrics.')
      const response = await authFetch('/api/evaluation_runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${promptMode} · ${ragEnabled ? 'RAG enabled' : 'RAG disabled'} · ${category}`, status: 'complete', summary: localPayload.data }) })
      const payload = await readApiResponse(response)
      if (!isRecord(payload.data) || !isString(payload.data.id)) throw new Error('The evaluation run did not return an id.')
      setLastRunId(payload.data.id)
      toast.success('Synthetic evaluation completed and stored')
      await loadRuns()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Evaluation run could not be recorded.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(null)
    }
  }

  const judgeCase = async () => {
    if (!inputText.trim() || !actualOutput.trim()) { setError('Provide an input and generated answer before judging.'); return }
    setError('')
    setLoading('judge')
    onAgentStart(JUDGE_AGENT_ID)
    try {
      const result = await callAIAgent(`Grade this illustrative evaluation case. This is not a Gold Set result. Return only the declared evaluation fields, label automated evaluation clearly, and do not modify any production answer.\n\nInput:\n${scrubText(inputText).redacted}\n\nExpected output:\n${expectedOutput}\n\nGenerated output:\n${actualOutput}\n\nConfiguration: ${promptMode}; ${ragEnabled ? 'RAG enabled' : 'RAG disabled'}; category ${category}`, JUDGE_AGENT_ID)
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? 'Evaluation judge failed.')
      if (!isString(result.response.message) || !isAgentMetadata(result.response.metadata)) throw new Error('The judge response envelope is incomplete.')
      const payload: unknown = result.response.result
      if (!isJudgeResult(payload)) throw new Error('The judge response did not include the declared evaluation fields.')
      setJudge(payload)
      setJudgeResponseStatus(result.response.status)
      setJudgeResponseMessage(result.response.message)
      setJudgeMetadata(result.response.metadata)
      const runId = lastRunId || 'illustrative-run'
      const response = await authFetch('/api/evaluation_cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluationRunId: runId, inputText, expectedOutput, actualOutput, passed: payload.failure_category === 'none' && payload.safety_status !== 'fail', evaluationNotes: `${payload.automated_evaluation_notice} Failure category: ${payload.failure_category}.` }) })
      const casePayload = await readApiResponse(response)
      if (isRecord(casePayload.data) && isString(casePayload.data.id) && isString(casePayload.data.evaluation_run_id) && isString(casePayload.data.input_text)) setCases((previous) => [casePayload.data as EvaluationCase, ...previous])
      toast.success('Illustrative case judged')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Evaluation judge failed.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(null)
      onAgentEnd()
    }
  }

  const exportResults = async () => {
    const text = cases.length ? cases.map((item) => `${item.id},${item.evaluation_run_id},${item.input_text},${item.passed ? 'passed' : 'review'}`).join('\n') : 'No evaluation case has been recorded.'
    const copied = await copyToClipboard(text)
    if (copied) toast.success('Evaluation rows copied for export')
    else toast.error('Could not copy evaluation rows.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Gold Set · Evaluation lab</p><h1 className="mt-2 text-balance font-serif text-3xl tracking-tight sm:text-4xl">Measure before you trust.</h1><p className="mt-3 max-w-3xl text-pretty text-sm leading-6 text-muted-foreground">Run the complete 3×2 experiment grid against the 80-case synthetic Gold Set. Results validate application behavior only and are not evidence of legal accuracy.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportResults} className="h-10"><Download className="mr-2 h-4 w-4" /> Export rows</Button><Button type="button" onClick={runEvaluation} disabled={loading !== null} className="h-10 active:scale-[0.98] transition-transform">{loading === 'run' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Run synthetic evaluation</Button></div></div>
      <Card className="border-primary/30 bg-primary/5 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Synthetic Gold Set is active</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The local 80-case set contains 30 math/logic, 30 fact/information, and 20 adversarial cases. All metrics are demonstration-only, not expert-verified legal-system results.</p></div></CardContent></Card>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Experiment configuration</CardTitle><CardDescription>These controls are saved with each blocked run.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><Label htmlFor="prompt-mode">Prompting mode</Label><Select value={promptMode} onValueChange={setPromptMode}><SelectTrigger id="prompt-mode" className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="zero-shot">Zero-shot</SelectItem><SelectItem value="few-shot">Few-shot</SelectItem><SelectItem value="structured-reasoning">Structured reasoning</SelectItem></SelectContent></Select></div><div><Label htmlFor="dataset-category">Dataset scope</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="dataset-category" className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem><SelectItem value="math-logic">Math / Logic</SelectItem><SelectItem value="fact-information">Fact / Information</SelectItem><SelectItem value="adversarial">Adversarial / safety</SelectItem></SelectContent></Select></div><div className="flex items-end"><div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5"><div><Label htmlFor="rag-enabled" className="cursor-pointer">RAG enabled</Label><p className="mt-1 text-[11px] text-muted-foreground">Stored with run config</p></div><Switch id="rag-enabled" checked={ragEnabled} onCheckedChange={setRagEnabled} /></div></div></CardContent></Card>
        <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Run posture</CardTitle></CardHeader><CardContent><MetricRow label="Prompting" value={promptMode} /><MetricRow label="Retrieval" value={ragEnabled ? 'Enabled' : 'Disabled'} /><MetricRow label="Dataset" value="80 synthetic cases" tone="good" /><MetricRow label="Latest run" value={runs[0]?.status ?? 'No run'} tone={runs[0]?.status === 'complete' ? 'good' : 'warn'} /></CardContent></Card>
      </div>
      <Card className="shadow-sm"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">Judge an illustrative case</CardTitle><CardDescription>Direct interaction with the Evaluation Judge. Not a Gold Set result.</CardDescription></div><Badge variant="outline" className="border-primary/30 text-primary">{activeAgentId === JUDGE_AGENT_ID ? 'Judge active' : 'Judge ready'}</Badge></div></CardHeader><CardContent className="grid min-w-0 gap-5 xl:grid-cols-3"><div className="space-y-2"><Label htmlFor="case-input">Input question</Label><Textarea id="case-input" value={inputText} onChange={(event) => setInputText(event.target.value)} rows={7} className="resize-y" /></div><div className="space-y-2"><Label htmlFor="case-expected">Expected output</Label><Textarea id="case-expected" value={expectedOutput} onChange={(event) => setExpectedOutput(event.target.value)} rows={7} className="resize-y" /></div><div className="space-y-2"><Label htmlFor="case-actual">Generated output</Label><Textarea id="case-actual" value={actualOutput} onChange={(event) => setActualOutput(event.target.value)} rows={7} className="resize-y" /></div><div className="xl:col-span-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">The judge receives the redacted input and the two answer texts; internal reasoning is not rendered.</p><Button type="button" onClick={judgeCase} disabled={loading !== null} className="active:scale-[0.98] transition-transform">{loading === 'judge' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gavel className="mr-2 h-4 w-4" />} Judge case</Button></div></CardContent></Card>
      {error ? <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
      {judge ? <Card className="border-primary/30 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Automated evaluation result</CardTitle><CardDescription>{judge.automated_evaluation_notice}</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><div className="rounded-xl border border-primary/30 bg-primary/5 p-5"><p className="font-mono text-[10px] uppercase tracking-wider text-primary">Overall score</p><p className="mt-2 font-serif text-5xl tabular-nums">{judge.overall_score}<span className="ml-1 text-xl text-muted-foreground">/ 5</span></p><p className={`mt-2 text-sm font-semibold ${statusClass(judge.safety_status)}`}>Safety: {judge.safety_status}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Failure: {judge.failure_category}</p><div className="mt-4 space-y-1 border-t border-primary/20 pt-3 text-xs leading-5"><p><span className="font-semibold">Envelope status:</span> {judgeResponseStatus}</p><p><span className="font-semibold">Envelope message:</span> {judgeResponseMessage}</p><p><span className="font-semibold">Agent:</span> {judgeMetadata?.agent_name ?? 'Not returned'}</p><p><span className="font-semibold">Model:</span> {judgeMetadata?.model_version ?? 'Not returned'}</p><p><span className="font-semibold">Timestamp:</span> {judgeMetadata?.timestamp ?? 'Not returned'}</p><p><span className="font-semibold">Redaction confirmed:</span> {judgeMetadata?.redaction_confirmed ? 'Yes' : 'Not confirmed'}</p></div></div><div className="grid gap-x-6 sm:grid-cols-2"><MetricRow label="Answer type rationale" value={judge.answer_type_rationale} /><MetricRow label="Answer quality rationale" value={judge.answer_quality_rationale} /><MetricRow label="Citation grounding score" value={`${judge.citation_grounding_score}/5`} /><MetricRow label="Citation grounding rationale" value={judge.citation_grounding_rationale} /><MetricRow label="Jurisdiction correctness" value={judge.jurisdiction_correctness} /><MetricRow label="Jurisdiction rationale" value={judge.jurisdiction_rationale} /><MetricRow label="Safety rationale" value={judge.safety_rationale} /><MetricRow label="Failure rationale" value={judge.failure_rationale} /><MetricRow label="Latency" value={`${judge.latency_ms} ms`} /><MetricRow label="Retrieval configuration" value={judge.retrieval_configuration} /><MetricRow label="Model version" value={judge.model_version} /><MetricRow label="Prompt version" value={judge.prompt_version} /></div></CardContent></Card> : null}
      <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Evaluation runs</CardTitle><CardDescription>Stored synthetic configurations and measured demonstration metrics.</CardDescription></CardHeader><CardContent>{runs.length ? <div className="space-y-2">{runs.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{run.name}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{run.id}</p></div><Badge variant="outline" className={run.status === 'complete' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-primary/35 text-primary'}>{run.status}</Badge></div>)}</div> : <EmptyState icon={FlaskConical} title="No evaluation runs yet" description="Run a synthetic configuration to store measured demonstration results." />}</CardContent></Card>
      {cases.length ? <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Case results</CardTitle><CardDescription>Persisted illustrative cases only.</CardDescription></CardHeader><CardContent className="space-y-2">{cases.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-border/70 p-3 md:grid-cols-[1fr_auto]"><div className="min-w-0"><p className="text-sm font-medium">{item.input_text}</p><p className="mt-1 text-xs text-muted-foreground">Run {item.evaluation_run_id} · {item.evaluation_notes ?? 'No notes returned'}</p></div><Badge variant="outline" className={item.passed ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-primary/35 text-primary'}>{item.passed ? 'Pass' : 'Review'}</Badge></div>)}</CardContent></Card> : null}
    </div>
  )
}

function AuthenticatedApp() {
  const { authFetch, isLoading, user } = useAuth()
  const [profileSaved, setProfileSaved] = useState(false)
  const [view, setView] = useState<View>('workspace')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sampleData, setSampleData] = useState(true)
  const [question, setQuestion] = useState(SAMPLE_QUESTION)
  const [category, setCategory] = useState(SAMPLE_CATEGORY)
  const [amountPaid, setAmountPaid] = useState(SAMPLE_AMOUNT)
  const [compensation, setCompensation] = useState(SAMPLE_COMPENSATION)
  const [purchaseDate, setPurchaseDate] = useState('2024-01-15')
  const [questionIsSample, setQuestionIsSample] = useState(true)
  const [showRedactionReview, setShowRedactionReview] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [managerData, setManagerData] = useState<ManagerResult | null>(null)
  const [managerMetadata, setManagerMetadata] = useState<AgentMetadata | null>(null)
  const [managerResponseStatus, setManagerResponseStatus] = useState('')
  const [managerResponseMessage, setManagerResponseMessage] = useState('')
  const [serverJurisdiction, setServerJurisdiction] = useState<ServerJurisdiction | null>(null)
  const [conversationId, setConversationId] = useState('')
  const [error, setError] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([])
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([])
  const [editingConversationId, setEditingConversationId] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  const jurisdictionPreview = useMemo(() => calculateJurisdictionPreview(amountPaid), [amountPaid])
  const privacy = useMemo(() => scrubText(question), [question])

  const loadConversations = useCallback(async () => {
    const response = await authFetch('/api/conversations')
    const payload = await readApiResponse(response)
    if (!Array.isArray(payload.data)) throw new Error('Conversation data was missing.')
    const next = payload.data.filter((item): item is Conversation => isRecord(item) && isString(item.id) && isString(item.title) && isString(item.status))
    setConversations(next)
  }, [authFetch])

  useEffect(() => {
    if (isLoading) return
    let cancelled = false
    const hydrate = async () => {
      try {
        await readApiResponse(await authFetch('/api/seed', { method: 'POST' }))
        if (!profileSaved) {
          await readApiResponse(await authFetch('/api/user_profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: isRecord(user) && isString(user.name) ? user.name : '', consentGiven: true, consentVersion: '2026-01', preferredLanguage: 'en' }) }))
          if (!cancelled) setProfileSaved(true)
        }
        if (!cancelled) await loadConversations()
      } catch (caught) {
        if (!cancelled) toast.error(caught instanceof Error ? caught.message : 'Workspace records could not be loaded.')
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [authFetch, isLoading, loadConversations, profileSaved, user])

  const toggleSampleData = (checked: boolean) => {
    setSampleData(checked)
    setShowRedactionReview(false)
    setError('')
    if (checked) {
      if (!question.trim() || questionIsSample) setQuestion(SAMPLE_QUESTION)
      if (!amountPaid.trim()) setAmountPaid(SAMPLE_AMOUNT)
      if (!compensation.trim()) setCompensation(SAMPLE_COMPENSATION)
      if (!category.trim()) setCategory(SAMPLE_CATEGORY)
      if (!purchaseDate.trim()) setPurchaseDate('2024-01-15')
      setQuestionIsSample(true)
    } else {
      if (questionIsSample) setQuestion('')
      if (amountPaid === SAMPLE_AMOUNT) setAmountPaid('')
      if (compensation === SAMPLE_COMPENSATION) setCompensation('')
      if (category === SAMPLE_CATEGORY) setCategory('')
      if (purchaseDate === '2024-01-15') setPurchaseDate('')
      setQuestionIsSample(false)
    }
  }

  const createConversation = async () => {
    const response = await authFetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: `${category || 'Consumer'} question`, status: 'open' }) })
    const payload = await readApiResponse(response)
    if (!isRecord(payload.data) || !isString(payload.data.id) || !isString(payload.data.title) || !isString(payload.data.status)) throw new Error('The conversation record did not return the declared fields.')
    const conversation = payload.data as Conversation
    setConversationId(conversation.id)
    setConversations((previous) => [conversation, ...previous.filter((item) => item.id !== conversation.id)])
    return conversation
  }

  const handleReview = () => {
    if (!question.trim()) { setError('Describe the consumer issue before reviewing redactions.'); return }
    setError('')
    setStage('scrubbing')
    setShowRedactionReview(true)
  }

  const handleResearch = async () => {
    if (!question.trim()) { setError('Describe the consumer issue before researching.'); return }
    setError('')
    setShowRedactionReview(false)
    setStage('jurisdiction')
    setActiveAgentId(MANAGER_AGENT_ID)
    try {
      const conversation = conversationId ? conversations.find((item) => item.id === conversationId) : await createConversation()
      if (!conversation) throw new Error('A conversation could not be created for this question.')
      const messageResponse = await authFetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation.id, originalText: question, redactedText: privacy.redacted, containsPii: privacy.containsPii, role: 'user', sequenceNumber: 0 }) })
      const messagePayload = await readApiResponse(messageResponse)
      if (!isRecord(messagePayload.data) || !isString(messagePayload.data.id)) throw new Error('The redacted message record did not return an id.')
      const serverRedacted = isString(messagePayload.data.redacted_text) ? messagePayload.data.redacted_text : privacy.redacted
      const messageId = messagePayload.data.id
      let deterministic: ServerJurisdiction | null = null
      try {
        const jurisdictionResponse = await authFetch('/api/jurisdiction_results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: conversation.id, messageId, amountPaid, compensationSought: compensation, state: 'Not provided', district: 'Not provided' }) })
        const jurisdictionPayload = await readApiResponse(jurisdictionResponse)
        if (isRecord(jurisdictionPayload.data)) deterministic = jurisdictionPayload.data as ServerJurisdiction
        setServerJurisdiction(deterministic)
      } catch (jurisdictionError) {
        setServerJurisdiction(null)
        toast.error(jurisdictionError instanceof Error ? jurisdictionError.message : 'Jurisdiction could not be calculated.')
      }
      setStage('researching')
      const localResponse = await authFetch('/api/local/guidance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: serverRedacted, amount_paid: amountPaid, issue_category: category, compensation_sought: compensation, purchase_date: purchaseDate }) })
      const result = await localResponse.json()
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? result.error ?? 'NyayaSetu could not complete the research.')
      if (!isString(result.response.message) || !isAgentMetadata(result.response.metadata)) throw new Error('The orchestrator response envelope is incomplete.')
      const payload: unknown = result.response.result
      if (!isManagerResult(payload)) throw new Error('The orchestrator response did not include the declared grounded-answer fields.')
      setManagerData(payload)
      setManagerResponseStatus(result.response.status)
      setManagerResponseMessage(result.response.message)
      setManagerMetadata(result.response.metadata)
      setStage('complete')
      setView('answer')
      try {
        const answerResponse = await authFetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, answerText: payload.final_answer, isGrounded: managerEvidenceStatus(payload) === 'approved_and_sufficient', confidenceScore: payload.evaluation.overall_score, promptVersionId: payload.evaluation.prompt_version }) })
        const answerPayload = await readApiResponse(answerResponse)
        if (isRecord(answerPayload.data) && isString(answerPayload.data.id)) {
          for (const citation of payload.citations) {
            await readApiResponse(await authFetch('/api/citations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answerId: answerPayload.data.id, sourceTitle: citation.title, sourceUrl: null, excerpt: citation.excerpt, rank: citation.rank }) }))
          }
        }
      } catch (persistError) {
        toast.error(persistError instanceof Error ? persistError.message : 'The answer could not be fully saved.')
      }
      toast.success('Grounded answer ready')
      await loadConversations()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Research could not be completed.'
      setError(message)
      setStage('idle')
      toast.error(message)
    } finally {
      setActiveAgentId(null)
    }
  }

  const openConversation = async (conversation: Conversation) => {
    setHistoryLoading(true)
    setError('')
    try {
      const messagesResponse = await authFetch(`/api/messages?conversationId=${encodeURIComponent(conversation.id)}`)
      const messagesPayload = await readApiResponse(messagesResponse)
      const nextMessages = Array.isArray(messagesPayload.data) ? messagesPayload.data.filter((item): item is SavedMessage => isRecord(item) && isString(item.id) && isString(item.conversation_id) && isString(item.role) && isString(item.original_text) && typeof item.contains_pii === 'boolean') : []
      setSavedMessages(nextMessages)
      const answerList: SavedAnswer[] = []
      for (const message of nextMessages) {
        const answerResponse = await authFetch(`/api/answers?messageId=${encodeURIComponent(message.id)}`)
        const answerPayload = await readApiResponse(answerResponse)
        if (Array.isArray(answerPayload.data)) {
          answerPayload.data.forEach((item) => { if (isRecord(item) && isString(item.id) && isString(item.message_id) && isString(item.answer_text) && typeof item.is_grounded === 'boolean') answerList.push(item as SavedAnswer) })
        }
      }
      setSavedAnswers(answerList)
      setSelectedConversation(conversation)
      setView('history')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Conversation could not be opened.'
      setError(message)
      toast.error(message)
    } finally {
      setHistoryLoading(false)
    }
  }

  const saveDraft = async () => {
    if (!question.trim()) { setError('Add a question before saving a draft.'); return }
    try {
      await createConversation()
      toast.success('Draft saved')
      await loadConversations()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Draft could not be saved.'
      setError(message)
      toast.error(message)
    }
  }

  const renameConversation = async (id: string) => {
    if (!editingTitle.trim()) return
    try {
      const response = await authFetch('/api/conversations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, title: editingTitle.trim() }) })
      const payload = await readApiResponse(response)
      if (!isRecord(payload.data) || !isString(payload.data.id)) throw new Error('The renamed conversation was not returned.')
      setConversations((previous) => previous.map((item) => item.id === id ? { ...item, title: editingTitle.trim() } : item))
      setEditingConversationId('')
      toast.success('Conversation renamed')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Conversation could not be renamed.'
      setError(message)
      toast.error(message)
    }
  }

  const deleteConversation = async (id: string) => {
    try {
      await readApiResponse(await authFetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }))
      setConversations((previous) => previous.filter((item) => item.id !== id))
      setPendingDeleteId('')
      if (selectedConversation?.id === id) setSelectedConversation(null)
      toast.success('Conversation deleted')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Conversation could not be deleted.'
      setError(message)
      toast.error(message)
    }
  }

  const copyAnswer = async () => {
    if (!managerData) return
    const text = `${managerData.summary}\n\n${managerData.final_answer}\n\nNext steps:\n${managerData.procedural_steps.join('\n')}`
    const copied = await copyToClipboard(text)
    if (copied) toast.success('Answer copied')
    else toast.error('Could not copy answer.')
  }

  const exportAnswer = async () => {
    if (!managerData) return
    const text = `NyayaSetu grounded answer\n\n${managerData.final_answer}\n\nJurisdiction: ${managerData.jurisdiction.selected_commission}\nAmount: ${managerData.jurisdiction.amount_used}\n\nSources:\n${managerData.citations.map((citation) => `${citation.rank}. ${citation.title} — ${citation.section}\n${citation.excerpt}`).join('\n') || 'No citations returned.'}`
    const copied = await copyToClipboard(text)
    if (copied) toast.success('Answer export copied')
    else toast.error('Could not export answer.')
  }

  const navigate = (nextView: View) => {
    setView(nextView)
    setMobileNavOpen(false)
    setError('')
  }

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'workspace', label: 'Research workspace', icon: LayoutDashboard },
    { id: 'history', label: 'Saved conversations', icon: History },
    { id: 'sources', label: 'Source explorer', icon: FileSearch },
    { id: 'evaluation', label: 'Evaluation lab', icon: FlaskConical },
  ]

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><LoadingBlock label="Loading your secure workspace…" /></div>

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2"><Button type="button" variant="ghost" size="icon" onClick={() => setMobileNavOpen((open) => !open)} className="h-10 w-10 shrink-0 md:hidden" aria-label="Toggle navigation"><Menu className="h-5 w-5" /></Button><Brand /></div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3"><Badge variant="outline" className="hidden border-primary/30 bg-primary/5 text-[10px] text-primary sm:inline-flex"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary" /> Local synthetic demo</Badge><div className="hidden items-center gap-2 lg:flex"><Switch id="sample-data" checked={sampleData} onCheckedChange={toggleSampleData} /><Label htmlFor="sample-data" className="cursor-pointer text-xs text-muted-foreground">Sample Data</Label></div><ThemeToggle /><div className="hidden h-6 w-px bg-border sm:block" /><UserMenu /></div>
        </div>
        {mobileNavOpen ? <div className="border-t border-border/80 bg-card px-4 py-3 md:hidden"><div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Workspace navigation</p><div className="flex items-center gap-2"><Switch id="mobile-sample-data" checked={sampleData} onCheckedChange={toggleSampleData} /><Label htmlFor="mobile-sample-data" className="text-xs">Sample Data</Label></div></div><div className="grid gap-1">{navItems.map((item) => { const Icon = item.icon; return <Button key={item.id} type="button" variant={view === item.id || (item.id === 'workspace' && view === 'answer') ? 'secondary' : 'ghost'} onClick={() => navigate(item.id)} className="justify-start"><Icon className="mr-2 h-4 w-4" />{item.label}</Button> })}</div></div> : null}
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-69px)] w-full max-w-[1600px] md:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/80 bg-muted/20 p-4 md:flex md:flex-col md:gap-5 lg:p-5">
          <Button type="button" onClick={() => { navigate('workspace'); setManagerData(null); setShowRedactionReview(false); setStage('idle') }} className="w-full active:scale-[0.98] transition-transform"><span className="mr-2 text-lg leading-none">+</span> New question</Button>
          <nav className="space-y-1" aria-label="Primary navigation">{navItems.map((item) => { const Icon = item.icon; const active = view === item.id || (item.id === 'workspace' && view === 'answer'); return <Button key={item.id} type="button" variant={active ? 'secondary' : 'ghost'} onClick={() => navigate(item.id)} className={`w-full justify-start ${active ? 'border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Icon className="mr-2 h-4 w-4" />{item.label}</Button> })}</nav>
          <div className="h-px bg-border/70" />
          <div className="min-h-0 flex-1"><div className="mb-2 flex items-center justify-between px-2"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recent</p><Button type="button" variant="ghost" size="icon" onClick={() => void loadConversations()} className="h-8 w-8" aria-label="Refresh conversations"><RefreshCw className="h-3.5 w-3.5" /></Button></div><div className="space-y-1">{conversations.slice(0, 5).map((conversation) => <Button key={conversation.id} type="button" variant="ghost" onClick={() => void openConversation(conversation)} className="h-auto w-full justify-start px-2 py-2 text-left text-xs font-normal text-muted-foreground hover:text-foreground"><span className="truncate">{conversation.title}</span></Button>)}{sampleData && <><p className="px-2 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">Examples</p><p className="truncate px-2 py-2 text-xs text-muted-foreground/70">Defective refrigerator</p><p className="truncate px-2 py-2 text-xs text-muted-foreground/70">Airline refund delay</p></>}{conversations.length === 0 && !sampleData ? <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">No saved conversations yet. Start with a new question.</p> : null}</div></div>
          <AgentStatusStrip activeAgentId={activeAgentId} />
        </aside>
        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1240px] min-w-0">
            {error && view !== 'workspace' ? <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}<Button type="button" variant="ghost" size="icon" onClick={() => setError('')} className="ml-auto h-7 w-7 text-destructive" aria-label="Dismiss error"><X className="h-4 w-4" /></Button></div> : null}
            {view === 'workspace' ? <div className="space-y-6"><div className="max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Guided research</p><h1 className="mt-2 text-balance font-serif text-3xl tracking-tight sm:text-4xl lg:text-5xl">What consumer issue can we help you understand?</h1><p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">Avoid names, phone numbers, account numbers, and addresses. Review the final redacted question before any hosted processing.</p></div><Card className="shadow-sm"><CardContent className="space-y-5 p-5 sm:p-7"><div><Label htmlFor="issue-question">Describe the issue</Label><Textarea id="issue-question" value={question} onChange={(event) => { setQuestion(event.target.value); setQuestionIsSample(false); setError('') }} rows={7} className="mt-2 resize-y" placeholder="Describe what happened, without names or contact details." /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><Label htmlFor="issue-category">Issue category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="issue-category" className="mt-2"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="Defective product">Defective product</SelectItem><SelectItem value="Service deficiency">Service deficiency</SelectItem><SelectItem value="Refund or cancellation">Refund or cancellation</SelectItem><SelectItem value="Misleading representation">Misleading representation</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div><div><Label htmlFor="amount-paid">Amount paid</Label><Input id="amount-paid" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} inputMode="decimal" placeholder="₹ amount" className="mt-2" /></div><div><Label htmlFor="compensation">Compensation sought</Label><Input id="compensation" value={compensation} onChange={(event) => setCompensation(event.target.value)} inputMode="decimal" placeholder="Optional" className="mt-2" /></div><div><Label htmlFor="purchase-date">Purchase date</Label><Input id="purchase-date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} className="mt-2" /></div></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><PrivacyPreview text={question} /><div className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Jurisdiction preview</p></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Calculated from amount paid by the application, not inferred by the model.</p><p className="mt-3 text-sm font-semibold">{jurisdictionPreview.selected_commission}</p><p className="mt-1 text-xs tabular-nums text-muted-foreground">{jurisdictionPreview.amount_used}</p><p className="mt-3 text-[11px] leading-5 text-primary">{jurisdictionPreview.warning}</p></div></div><div className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Information only · Not legal representation</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={saveDraft} disabled={!question.trim()} className="active:scale-[0.98] transition-transform"><Save className="mr-2 h-4 w-4" /> Save draft</Button><Button type="button" onClick={handleReview} disabled={!question.trim()} className="active:scale-[0.98] transition-transform">Review &amp; research <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>{error ? <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}</CardContent></Card><StagePills stage={stage} />{showRedactionReview ? <Card className="border-primary/30 bg-primary/5 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Review redaction before research</CardTitle><CardDescription>Only the version below will be included in the hosted agent request.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border bg-background/70 p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Redacted question</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{privacy.redacted}</p></div><div className="flex flex-wrap gap-2">{privacy.removed.length ? privacy.removed.map((item) => <Badge key={item} variant="outline" className="border-primary/30 text-primary">{item} removed</Badge>) : <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">No PII detected</Badge>}</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={() => { setShowRedactionReview(false); setStage('idle') }}>Back to edit</Button><Button type="button" onClick={() => void handleResearch()} disabled={activeAgentId !== null} className="active:scale-[0.98] transition-transform">{activeAgentId === MANAGER_AGENT_ID ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Approve &amp; research</Button></div></CardContent></Card> : null}{activeAgentId === MANAGER_AGENT_ID ? <LoadingBlock label={stage === 'jurisdiction' ? 'Calculating jurisdiction locally…' : 'Researching, reranking, and assembling guidance…'} /> : null}</div> : null}
            {view === 'answer' && managerData ? <AnswerWorkspace data={managerData} metadata={managerMetadata} serverJurisdiction={serverJurisdiction} responseStatus={managerResponseStatus} responseMessage={managerResponseMessage} onBack={() => navigate('workspace')} onCopy={() => void copyAnswer()} onExport={() => void exportAnswer()} /> : null}
            {view === 'answer' && !managerData ? <EmptyState icon={BookOpen} title="No answer selected" description="Start a guided question or open a saved conversation to inspect its answer." action={<Button type="button" onClick={() => navigate('workspace')}>Start a question <ArrowRight className="ml-2 h-4 w-4" /></Button>} /> : null}
            {view === 'history' ? <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Saved conversations</p><h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Keep the trail organized.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Reopen, rename, export, or delete your own saved research. Questions are redacted before local synthetic processing.</p></div><Button type="button" onClick={() => navigate('workspace')}><span className="mr-2 text-lg leading-none">+</span> New question</Button></div><div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Your conversations</CardTitle><CardDescription>{conversations.length} saved records in this account.</CardDescription></CardHeader><CardContent className="space-y-2">{historyLoading ? <LoadingBlock label="Opening conversation…" /> : conversations.length ? conversations.map((conversation) => <div key={conversation.id} className="rounded-xl border border-border/80 bg-muted/20 p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1">{editingConversationId === conversation.id ? <div className="flex flex-wrap gap-2"><Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="h-9" /><Button type="button" size="sm" onClick={() => void renameConversation(conversation.id)}>Save</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingConversationId('')}>Cancel</Button></div> : <><p className="truncate text-sm font-semibold">{conversation.title}</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{conversation.status} · {conversation.id}</p></>}</div><Badge variant="outline" className="shrink-0">{conversation.status}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void openConversation(conversation)}><BookOpen className="mr-2 h-3.5 w-3.5" /> Open</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setEditingConversationId(conversation.id); setEditingTitle(conversation.title) }}><Edit3 className="mr-2 h-3.5 w-3.5" /> Rename</Button><Button type="button" variant="ghost" size="sm" onClick={() => setPendingDeleteId(conversation.id)} className="text-destructive hover:text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</Button></div>{pendingDeleteId === conversation.id ? <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs"><span>Delete this conversation permanently?</span><span className="flex gap-2"><Button type="button" variant="destructive" size="sm" onClick={() => void deleteConversation(conversation.id)}>Confirm delete</Button><Button type="button" variant="ghost" size="sm" onClick={() => setPendingDeleteId('')}>Keep</Button></span></div> : null}</div>) : <EmptyState icon={History} title="No saved conversations" description={sampleData ? 'Sample Data is on for the research form. Save a draft or run a question to create your first real record.' : 'Start a question to create your first persistent conversation.'} action={<Button type="button" onClick={() => navigate('workspace')}>Start research</Button>} />}</CardContent></Card><Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-lg">Conversation detail</CardTitle><CardDescription>{selectedConversation?.title ?? 'Select a saved record to inspect it.'}</CardDescription></CardHeader><CardContent>{selectedConversation ? <div className="space-y-5">{savedMessages.map((message) => <div key={message.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{message.role} message</p>{message.contains_pii ? <Badge variant="outline" className="border-primary/30 text-primary">PII redacted</Badge> : <Badge variant="outline">No PII detected</Badge>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.redacted_text || message.original_text}</p>{savedAnswers.filter((answer) => answer.message_id === message.id).map((answer) => <div key={answer.id} className="mt-4 border-t border-border/70 pt-4"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Saved answer</p><Badge variant="outline" className="ml-auto">{answer.is_grounded ? 'Grounded' : 'Limited'}</Badge></div><div className="mt-3">{renderMarkdown(answer.answer_text)}</div></div>)}</div>)}{savedMessages.length === 0 ? <p className="text-sm text-muted-foreground">This conversation has no saved messages yet.</p> : null}<Button type="button" variant="outline" onClick={() => { setQuestion(savedMessages[0]?.redacted_text || ''); setQuestionIsSample(false); navigate('workspace') }}><ArrowLeft className="mr-2 h-4 w-4" /> Continue as a new question</Button></div> : <EmptyState icon={BookOpen} title="Nothing selected" description="Open a conversation from the list to see its redacted prompt and saved answer." />}</CardContent></Card></div></div> : null}
            {view === 'sources' ? <SourceExplorer activeAgentId={activeAgentId} onAgentStart={setActiveAgentId} onAgentEnd={() => setActiveAgentId(null)} /> : null}
            {view === 'evaluation' ? <EvaluationLab activeAgentId={activeAgentId} onAgentStart={setActiveAgentId} onAgentEnd={() => setActiveAgentId(null)} /> : null}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <ProtectedRoute unauthenticatedFallback={<AuthScreen />}>
        <AuthenticatedApp />
      </ProtectedRoute>
    </AuthProvider>
  )
}
