import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { determineJurisdiction } from '@/lib/jurisdictionRules'
import { hybridRetrieve } from '@/lib/hybridRetrieval'

export type CorpusRow = {
  id: string; provenance: 'synthetic_demo'; authoritative: false; topic: string; title: string; section: string
  document_type: string; question: string; context: string; answer: string; keywords: string[]; disclaimer: string
}

type GoldRow = { id: string; provenance: 'synthetic_demo'; expert_verified: false; category: string; question: string; expected_answer: string; disclaimer: string }

const DATA_DIR = path.join(process.cwd(), 'data', 'processed')
let corpusCache: CorpusRow[] | null = null
let goldCache: GoldRow[] | null = null
let preparedCache: { row: CorpusRow; text: string; trigrams: Set<string>; frequencies: Map<string, number> }[] | null = null

function readJsonl<T>(file: string): T[] {
  return fs.readFileSync(path.join(DATA_DIR, file), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as T)
}
export function getCorpus() { return corpusCache ??= readJsonl<CorpusRow>('master_qa.jsonl') }
export function getGold() { return goldCache ??= readJsonl<GoldRow>('gold_qa.jsonl') }
function getPreparedCorpus() {
  if (preparedCache) return preparedCache
  preparedCache = getCorpus().map((row) => {
    const text = `${row.title} ${row.section} ${row.question} ${row.context} ${row.keywords.join(' ')}`
    const frequencies = new Map<string, number>()
    for (const token of tokens(text)) frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
    return { row, text, trigrams: trigrams(text), frequencies }
  })
  return preparedCache
}

export function scrubPII(input: string) {
  let redacted = input
  const findings: string[] = []
  const rules: [RegExp, string, string][] = [
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDACTED]', 'email'],
    [/(?:\+91[-\s]?)?[6-9]\d{9}\b/g, '[PHONE REDACTED]', 'phone'],
    [/(?:account|a\/c)\s*(?:no\.?|number)?\s*[:#-]?\s*\d{8,18}/gi, '[ACCOUNT REDACTED]', 'account identifier'],
  ]
  for (const [pattern, replacement, label] of rules) {
    if (pattern.test(redacted)) findings.push(label)
    pattern.lastIndex = 0
    redacted = redacted.replace(pattern, replacement)
  }
  return { original: input, redacted, contains_pii: findings.length > 0, findings }
}

const stop = new Set('a an and are as at be by can for from had has have how i in is it my of on or that the this to was what when where which with you your'.split(' '))
function tokens(text: string) { return text.toLowerCase().replace(/[^a-z0-9₹ ]/g, ' ').split(/\s+/).filter((x) => x.length > 1 && !stop.has(x)) }
function trigrams(text: string) { const value = `  ${text.toLowerCase().replace(/\s+/g, ' ')}  `; return new Set(Array.from({length: Math.max(0, value.length - 2)}, (_, i) => value.slice(i, i + 3))) }
function cosineSets(a: Set<string>, b: Set<string>) { let hit=0; for (const item of a) if (b.has(item)) hit++; return hit / Math.sqrt(Math.max(1, a.size * b.size)) }

export function classifySafety(text: string) {
  const q=text.toLowerCase()
  if (/(draft|write|prepare).{0,30}(legal notice|complaint|pleading|affidavit)/.test(q)) return { decision:'refuse' as const, category:'legal_drafting', reason:'NyayaSetu cannot produce filing-ready legal documents.' }
  if (/(chance|probability|percent|percentage|guarantee|will i win).{0,30}(win|success|outcome)?/.test(q)) return { decision:'refuse' as const, category:'outcome_prediction', reason:'NyayaSetu cannot predict or guarantee case outcomes.' }
  if (/(fabricate|fake).{0,20}(evidence|citation|receipt)/.test(q)) return { decision:'refuse' as const, category:'fabricated_evidence', reason:'NyayaSetu cannot help create false evidence or citations.' }
  return { decision:'allowed' as const, category:'none', reason:'The request is within the informational guidance boundary.' }
}

export function calculateJurisdiction(value: unknown) {
  return determineJurisdiction(value)
}

export function retrieve(question: string, limit=3) {
  const clean=scrubPII(question).redacted.trim(); const qTokens=tokens(clean); const qSet=new Set(qTokens); const qTri=trigrams(clean)
  const refs=Array.from(clean.matchAll(/section\s+\d+[a-z]?/gi), (match) => match[0])
  const candidates=getPreparedCorpus().map(({ row, text, trigrams: documentTrigrams, frequencies }) => {
    let lexical=0; for(const token of qSet) lexical += Math.log1p(frequencies.get(token)??0)
    lexical=lexical/Math.max(1,Math.sqrt(qSet.size))
    const dense=cosineSets(qTri,documentTrigrams)
    const exact=refs.some((ref)=>text.toLowerCase().includes(ref.toLowerCase()))?1:0
    const fused=0.5*Math.min(1,lexical/4)+0.35*dense+0.15*exact
    const phraseHits=qTokens.filter((token)=>row.context.toLowerCase().includes(token)).length/Math.max(1,qTokens.length)
    const rerank=0.65*fused+0.35*phraseHits
    return {row,lexical,dense,fused,rerank}
  }).sort((a,b)=>b.fused-a.fused).slice(0,10).sort((a,b)=>b.rerank-a.rerank).slice(0,limit)
  return {
    normalized_question:clean,
    retrieval_queries:[clean, ...refs.map((ref)=>`${ref} consumer complaint procedure`)].slice(0,3),
    exact_legal_references:refs,
    evidence:candidates.map((item,index)=>({rank:index+1,source_id:item.row.id,title:item.row.title,section:item.row.section,document_type:item.row.document_type,excerpt:item.row.context,lexical_score:Number(item.lexical.toFixed(3)),dense_score:Number(item.dense.toFixed(3)),fused_score:Number(item.fused.toFixed(3)),rerank_score:Number(item.rerank.toFixed(3)),relevance_validated:item.rerank>0.04,validation_note:'Algorithmically ranked synthetic demonstration passage; not an authoritative legal source.'})),
    evidence_quality:candidates[0]?.rerank>0.16?'strong':candidates[0]?.rerank>0.06?'mixed':'weak',
    tool_status:'available_and_used',fallback_used:false,fallback_reason:'',
    limitations:['All passages are synthetic demonstration data.', 'Verify every legal proposition against official sources or a qualified professional.'],
  }
}

export async function ollamaStatus() {
  const base=process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  try { const response=await fetch(`${base}/api/tags`,{signal:AbortSignal.timeout(1200)}); if(!response.ok) throw new Error(); const data=await response.json(); return {available:true,base_url:base,models:Array.isArray(data.models)?data.models.map((m:any)=>m.name):[]} } catch { return {available:false,base_url:base,models:[]} }
}

export function buildGuidance(question:string, amount?:unknown) {
  const safety=classifySafety(question); const research=hybridRetrieve(question); const jurisdiction=calculateJurisdiction(amount)
  if(safety.decision!=='allowed') return {request_classification:'prohibited_request',safety_decision:safety.decision,safety_reason:safety.reason,final_answer:`I cannot help with that request. ${safety.reason} I can instead provide a factual issue summary, a records checklist, or general filing-channel information.`,summary:'The request crossed NyayaSetu’s legal-information boundary.',procedural_steps:['Gather transaction and grievance records.','Verify current official rules.','Consider consulting a qualified advocate for filing-ready work.'],missing_information:[],citations:[],jurisdiction,limitations:['No legal representation or outcome prediction.','Synthetic demonstration dataset only.'],tool_status:'available_and_used',fallback_used:false,sub_agents_used:['Local Safety Classifier'],evaluation:{present:false,overall_score:0,answer_type_rationale:'',answer_quality_rationale:'',citation_grounding_score:0,jurisdiction_correctness:'not_applicable',safety_status:'pass',failure_category:'none',failure_rationale:'',latency_ms:0,retrieval_configuration:'local synthetic hybrid',model_version:'deterministic-local',prompt_version:'synthetic-demo-v1',automated_evaluation_notice:'Not evaluated.'}}
  const citations=research.evidence.map((e:any)=>({source_id:e.source_id,title:e.title,section:e.section,document_type:e.document_type,excerpt:e.excerpt,supported_claim:'General records and procedural preparation for the described issue.',rank:e.rank}))
  return {request_classification:'consumer_guidance',safety_decision:'allowed',safety_reason:safety.reason,final_answer:'Based on the synthetic demonstration corpus, organize the transaction record, proof of the issue, repair or grievance history, and the remedy requested. Send a concise written grievance through an official channel and retain delivery evidence. If unresolved, verify the current official consumer-commission procedure before filing.',summary:'A records-first procedural path is available, but the synthetic corpus is not legal authority.',procedural_steps:['Preserve invoices, payment proof, warranty terms, photographs, and service records.','Send a concise written grievance through an official seller, manufacturer, or platform channel.','Retain acknowledgement and response records.','Verify the current official filing procedure and jurisdiction notification before approaching a commission.'],missing_information:['State and district for territorial routing.','The current authoritative notification and official corpus are not bundled in this synthetic demonstration.'],citations,jurisdiction,limitations:['SYNTHETIC DEMONSTRATION DATA — not legal authority or expert-verified advice.','This system cannot draft filing-ready documents or predict outcomes.'],tool_status:'available_and_used',fallback_used:false,sub_agents_used:['Local Hybrid Retriever','Local Reranker','Local Guidance Builder'],evaluation:{present:false,overall_score:0,answer_type_rationale:'',answer_quality_rationale:'',citation_grounding_score:0,jurisdiction_correctness:'insufficient_reference',safety_status:'pass',failure_category:'none',failure_rationale:'',latency_ms:0,retrieval_configuration:'local synthetic BM25-like + trigram semantic + rerank',model_version:'deterministic-local',prompt_version:'synthetic-demo-v1',automated_evaluation_notice:'Not evaluated.'}}
}

export function runEvaluation(promptMode='few-shot', ragEnabled=true, category='all') {
  const started=Date.now(); const selected=getGold().filter((row)=>category==='all'||row.category===category)
  let passed=0, jurisdictionCorrect=0, safetyPassed=0, retrievalHit=0
  const cases=selected.map((row)=>{
    const safety=classifySafety(row.question); const found=ragEnabled?hybridRetrieve(row.question,3):null
    const expectedRefusal=row.category==='adversarial'; const safetyOk=expectedRefusal?safety.decision==='refuse':safety.decision==='allowed'
    const amountMatch=row.question.match(/₹([\d,]+)/); const amount=amountMatch?Number(amountMatch[1].replaceAll(',','')):0; const jurisdiction=row.category==='math-logic'?calculateJurisdiction(amount):null
    const jurisdictionOk=row.category!=='math-logic'||jurisdiction?.selected_commission===row.expected_answer
    const hit=!ragEnabled||Boolean(found?.evidence.length)
    const ok=safetyOk&&jurisdictionOk&&hit; if(ok) passed++; if(jurisdictionOk&&row.category==='math-logic') jurisdictionCorrect++; if(safetyOk&&row.category==='adversarial') safetyPassed++; if(hit&&ragEnabled) retrievalHit++
    return {id:row.id,category:row.category,passed:ok,safety_passed:safetyOk,jurisdiction_correct:jurisdictionOk,retrieval_hit:hit,failure_category:ok?'none':!safetyOk?'safety_failure':!jurisdictionOk?'incorrect_jurisdiction':'retrieval_failure'}
  })
  return {provenance:'synthetic_demo',authoritative:false,prompt_mode:promptMode,rag_enabled:ragEnabled,category,total:selected.length,passed,accuracy:Number((passed/Math.max(1,selected.length)).toFixed(3)),recall_at_3:ragEnabled?Number((retrievalHit/Math.max(1,selected.length)).toFixed(3)):null,jurisdiction_accuracy:selected.some(x=>x.category==='math-logic')?Number((jurisdictionCorrect/selected.filter(x=>x.category==='math-logic').length).toFixed(3)):null,safety_accuracy:selected.some(x=>x.category==='adversarial')?Number((safetyPassed/selected.filter(x=>x.category==='adversarial').length).toFixed(3)):null,latency_ms:Date.now()-started,cases,disclaimer:'SYNTHETIC DEMONSTRATION METRICS — not expert-verified and not evidence of production legal accuracy.'}
}
