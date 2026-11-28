function csvCell(value: unknown) { const text = typeof value === 'string' ? value : JSON.stringify(value ?? ''); return `"${text.replaceAll('"','""')}"` }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || !body.data || (body.format !== 'json' && body.format !== 'csv')) return Response.json({ success: false, error: 'data and format json|csv are required' }, { status: 400 })
  const filename = `nyayasetu-week4-${new Date().toISOString().slice(0,10)}.${body.format}`
  if (body.format === 'json') return new Response(JSON.stringify(body.data, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${filename}"` } })
  const runs = Array.isArray(body.data.runs) ? body.data.runs : []
  const rows = [['run_id','prompt_mode','rag_enabled','case_id','category','passed','score','failure_category','input','expected','actual']]
  for (const run of runs) for (const item of Array.isArray(run.cases) ? run.cases : []) rows.push([run.id,run.prompt_mode,run.rag_enabled,item.id,item.category,item.passed,item.judge?.overall_score,item.judge?.failure_category,item.input_text,item.expected_output,item.actual_output])
  return new Response(rows.map(row=>row.map(csvCell).join(',')).join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` } })
}
