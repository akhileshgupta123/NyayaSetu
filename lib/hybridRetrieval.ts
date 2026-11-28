import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import type { CorpusRow } from '@/lib/localLegal'

type IndexedDocument = { id: string; topic: string; length: number; embedding: number[] }
type PersistedIndex = { version: string; provenance: string; authoritative: boolean; dimensions: number; corpus_rows: number; corpus_sha256: string; created_at: string; embedding_method: string; lexical_method: string; documents: IndexedDocument[] }

const DATA_DIR = path.join(process.cwd(), 'data', 'processed')
const stop = new Set('a an and are as at be by can for from had has have how i in is it my of on or that the this to was what when where which with you your'.split(' '))
let cache: ReturnType<typeof prepare> | null = null

function tokenize(text: string) { return text.toLowerCase().replace(/[^a-z0-9₹ ]/g, ' ').split(/\s+/).filter((item) => item.length > 1 && !stop.has(item)) }
function hash(value: string) { let h=2166136261; for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)} return h>>>0 }
function embedding(text: string, dimensions: number) {
  const vector=new Array(dimensions).fill(0); const words=tokenize(text); const features=[...words]
  for(const word of words) for(let i=0;i<Math.max(0,word.length-2);i++) features.push(`#${word.slice(i,i+3)}`)
  for(const feature of features){const h=hash(feature);vector[h%dimensions]+=(h&256)?1:-1}
  const norm=Math.sqrt(vector.reduce((sum,value)=>sum+value*value,0))||1
  return vector.map((value)=>Math.round((value/norm)*127))
}
function cosine(a:number[],b:number[]){let dot=0,aa=0,bb=0;for(let i=0;i<Math.min(a.length,b.length);i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return dot/Math.sqrt(Math.max(1,aa*bb))}

function prepare() {
  const corpus=fs.readFileSync(path.join(DATA_DIR,'master_qa.jsonl'),'utf8').trim().split('\n').map((line)=>JSON.parse(line) as CorpusRow)
  const index=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'hybrid_index.json'),'utf8')) as PersistedIndex
  const indexed=new Map(index.documents.map((item)=>[item.id,item]))
  const documentFrequency=new Map<string,number>()
  const documents=corpus.map((row)=>{
    const text=`${row.title} ${row.section} ${row.question} ${row.context} ${row.answer} ${row.keywords.join(' ')}`
    const terms=tokenize(text); const frequency=new Map<string,number>(); for(const term of terms) frequency.set(term,(frequency.get(term)??0)+1)
    for(const term of new Set(terms)) documentFrequency.set(term,(documentFrequency.get(term)??0)+1)
    return {row,text,frequency,length:terms.length,vector:indexed.get(row.id)?.embedding??embedding(text,index.dimensions)}
  })
  const averageLength=documents.reduce((sum,item)=>sum+item.length,0)/Math.max(1,documents.length)
  return {index,documents,documentFrequency,averageLength}
}
function state(){return cache??=prepare()}

function bm25(queryTerms:string[], frequency:Map<string,number>, length:number, total:number, averageLength:number, df:Map<string,number>){
  const k1=1.5,b=0.75;let score=0
  for(const term of new Set(queryTerms)){const f=frequency.get(term)??0;if(!f)continue;const documentCount=df.get(term)??0;const idf=Math.log(1+(total-documentCount+0.5)/(documentCount+0.5));score+=idf*(f*(k1+1))/(f+k1*(1-b+b*length/averageLength))}
  return score
}
function minMax(items:{id:string;score:number}[]){const min=Math.min(...items.map(x=>x.score)),max=Math.max(...items.map(x=>x.score));return new Map(items.map(x=>[x.id,max===min?1:(x.score-min)/(max-min)]))}

export function hybridRetrieve(question:string,limit=3){
  const started=Date.now();const {index,documents,documentFrequency,averageLength}=state();const queryTerms=tokenize(question);const queryVector=embedding(question,index.dimensions);const total=documents.length
  const lexical=documents.map((item)=>({id:item.row.id,score:bm25(queryTerms,item.frequency,item.length,total,averageLength,documentFrequency)})).sort((a,b)=>b.score-a.score).slice(0,10)
  const dense=documents.map((item)=>({id:item.row.id,score:cosine(queryVector,item.vector)})).sort((a,b)=>b.score-a.score).slice(0,10)
  const lexicalNorm=minMax(lexical),denseNorm=minMax(dense);const lexicalRank=new Map(lexical.map((x,i)=>[x.id,i+1])),denseRank=new Map(dense.map((x,i)=>[x.id,i+1]));const ids=new Set([...lexical.map(x=>x.id),...dense.map(x=>x.id)])
  const refs=Array.from(question.matchAll(/section\s+\d+[a-z]?/gi),match=>match[0].toLowerCase())
  const fused=Array.from(ids).map((id)=>{const document=documents.find(item=>item.row.id===id)!;const lr=lexicalRank.get(id),dr=denseRank.get(id);const rrf=(lr?1/(60+lr):0)+(dr?1/(60+dr):0);const exact=refs.some(ref=>document.text.toLowerCase().includes(ref))?1:0;return {document,lexical:lexical.find(x=>x.id===id)?.score??0,dense:dense.find(x=>x.id===id)?.score??0,fused:rrf+exact*0.02,lexicalNormalized:lexicalNorm.get(id)??0,denseNormalized:denseNorm.get(id)??0}}).sort((a,b)=>b.fused-a.fused).slice(0,10)
  const unique=new Map<string,(typeof fused)[number]>();for(const item of fused){const key=`${item.document.row.topic}:${item.document.row.context.slice(0,120)}`;if(!unique.has(key))unique.set(key,item)}
  const reranked=Array.from(unique.values()).map((item)=>{const text=item.document.text.toLowerCase();const coverage=queryTerms.filter(term=>text.includes(term)).length/Math.max(1,new Set(queryTerms).size);const titleCoverage=queryTerms.filter(term=>item.document.row.title.toLowerCase().includes(term)).length/Math.max(1,new Set(queryTerms).size);const score=0.42*item.lexicalNormalized+0.28*((item.denseNormalized+1)/2)+0.2*coverage+0.1*titleCoverage;return{...item,rerank:score}}).sort((a,b)=>b.rerank-a.rerank).slice(0,limit)
  return {normalized_question:question.trim(),retrieval_queries:[question.trim(),...refs.map(ref=>`${ref} consumer complaint procedure`)].slice(0,3),exact_legal_references:refs,evidence:reranked.map((item,i)=>({rank:i+1,source_id:item.document.row.id,title:item.document.row.title,section:item.document.row.section,document_type:item.document.row.document_type,topic:item.document.row.topic,excerpt:item.document.row.context,lexical_score:Number(item.lexical.toFixed(3)),dense_score:Number(item.dense.toFixed(3)),fused_score:Number(item.fused.toFixed(4)),rerank_score:Number(item.rerank.toFixed(3)),relevance_validated:item.rerank>0.15,validation_note:'Week 2 BM25 + persisted dense index + reciprocal-rank fusion + cross-encoder-style reranking over synthetic data.'})),evidence_quality:reranked[0]?.rerank>0.5?'strong':reranked[0]?.rerank>0.25?'mixed':'weak',tool_status:'available_and_used',fallback_used:false,fallback_reason:'',limitations:['All passages are synthetic demonstration data.','Dense embeddings use a deterministic local hashing alternative to all-mpnet-base-v2.','Reranking uses a local cross-encoder-style feature scorer alternative to FlashRank.'],retrieval_metadata:{engine_version:index.version,corpus_rows:index.corpus_rows,index_dimensions:index.dimensions,persisted_index:true,lexical_candidates:lexical.length,dense_candidates:dense.length,fused_candidates:fused.length,returned:reranked.length,latency_ms:Date.now()-started}}
}

const topicOrder=['defective_goods','deficiency_service','section_35','ecommerce','insurance','banking','travel','housing','medical','jurisdiction']
export function runRecallAt3Benchmark(){
  const started=Date.now();const queries=Array.from({length:30},(_,i)=>{const topic=topicOrder[i%topicOrder.length];return{id:`W2-${String(i+1).padStart(3,'0')}`,topic,question:`Synthetic ${topic.replaceAll('_',' ')} retrieval benchmark ${i+1}: what records, legal section, or procedure applies to this consumer issue?`}})
  const cases=queries.map(item=>{const result=hybridRetrieve(item.question,3);const returned=result.evidence.map(e=>e.source_id);const topics=result.evidence.map(e=>e.topic);const hit=topics.includes(item.topic);return{...item,returned_source_ids:returned,returned_topics:topics,hit_at_3:hit,latency_ms:result.retrieval_metadata.latency_ms}})
  const hits=cases.filter(item=>item.hit_at_3).length
  return {run_type:'week_2_retrieval_benchmark',provenance:'synthetic_demo',authoritative:false,engine:'BM25 + deterministic 96d dense embeddings + RRF + cross-encoder-style reranker',dataset:'frozen-synthetic-week2-v1',total:cases.length,hits,recall_at_3:Number((hits/cases.length).toFixed(3)),target_recall_at_3:0.9,target_met:hits/cases.length>=0.9,latency_ms:Date.now()-started,average_query_latency_ms:Math.round(cases.reduce((sum,item)=>sum+item.latency_ms,0)/cases.length),index:state().index,cases,disclaimer:'Synthetic Recall@3 validates the hackathon retrieval pipeline only; it is not an expert legal benchmark.'}
}

export function hybridIndexStatus(){const {index}=state();return{version:index.version,provenance:index.provenance,authoritative:index.authoritative,dimensions:index.dimensions,corpus_rows:index.corpus_rows,corpus_sha256:index.corpus_sha256,created_at:index.created_at,embedding_method:index.embedding_method,lexical_method:index.lexical_method,index_path:'data/processed/hybrid_index.json',loaded:true}}
