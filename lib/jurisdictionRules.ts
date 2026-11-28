export const JURISDICTION_RULESET = {
  id: 'cpa-pecuniary-synthetic-2021-v1',
  version: '2021-synthetic-hackathon-v1',
  effective_date: '2021-12-30 (unverified demonstration)',
  authority: 'Consumer Protection (Jurisdiction of the District Commission, the State Commission and the National Commission) Rules, 2021 — synthetic configuration pending authoritative verification',
  authority_status: 'synthetic_unverified' as const,
  basis: 'consideration_paid',
  currency: 'INR',
  tiers: [
    { commission: 'District Consumer Disputes Redressal Commission', lower_inclusive: 0.01, upper_inclusive: 5_000_000 },
    { commission: 'State Consumer Disputes Redressal Commission', lower_exclusive: 5_000_000, upper_inclusive: 20_000_000 },
    { commission: 'National Consumer Disputes Redressal Commission', lower_exclusive: 20_000_000, upper_inclusive: null },
  ],
}

export function parseConsideration(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return { amount: null, error: 'missing' as const }
  const normalized = String(value).replace(/[,₹\s]/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return { amount: null, error: 'invalid_format' as const }
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0) return { amount: null, error: 'non_positive' as const }
  return { amount, error: null }
}

export function determineJurisdiction(value: unknown) {
  const parsed = parseConsideration(value)
  if (parsed.amount === null) {
    const reason = parsed.error === 'missing' ? 'Consideration paid is required.' : parsed.error === 'invalid_format' ? 'Consideration paid must be a valid INR number.' : 'Consideration paid must be greater than zero.'
    return { status: 'insufficient' as const, selected_commission: '', amount_used: '', amount_numeric: null, rule_version: JURISDICTION_RULESET.version, rule_id: JURISDICTION_RULESET.id, effective_date: JURISDICTION_RULESET.effective_date, authority: JURISDICTION_RULESET.authority, authority_status: JURISDICTION_RULESET.authority_status, explanation: reason, warning: 'No commission was guessed. Verify the authoritative notification before filing.', missing_fields: ['consideration_paid'], input_error: parsed.error }
  }
  const amount = parsed.amount
  const tier = JURISDICTION_RULESET.tiers.find((item) => {
    const lower = 'lower_inclusive' in item ? amount >= Number(item.lower_inclusive) : amount > Number(item.lower_exclusive)
    const upper = item.upper_inclusive === null ? true : amount <= Number(item.upper_inclusive)
    return lower && upper
  })!
  return { status: 'calculated' as const, selected_commission: tier.commission, amount_used: `₹${amount.toLocaleString('en-IN')}`, amount_numeric: amount, rule_version: JURISDICTION_RULESET.version, rule_id: JURISDICTION_RULESET.id, effective_date: JURISDICTION_RULESET.effective_date, authority: JURISDICTION_RULESET.authority, authority_status: JURISDICTION_RULESET.authority_status, explanation: `Selected deterministically from consideration paid using ${JURISDICTION_RULESET.id}.`, warning: 'Hackathon synthetic rule configuration. Verify the current official notification before filing.', missing_fields: [], input_error: null }
}
