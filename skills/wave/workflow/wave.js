export const meta = {
  name: 'wave-fanout',
  description: 'Run one wave of a .plans/<slug> slice graph: fan out one agent per slice, each in its wave-made worktree, committing its work',
  phases: [{ title: 'Run wave' }],
}

if (typeof args === 'string') log('⚠ args arrived as a STRING, not an object — parsing it (harness quirk)')
let a
try {
  a = (typeof args === 'string' ? JSON.parse(args) : args) || {}
} catch (e) {
  throw new Error(`wave fanout: args arrived as a string that isn't valid JSON (${e.message}). Re-invoke the Workflow tool with the full \`wave wave\` stdout JSON as the args OBJECT — copy it verbatim, don't retype or wrap it in quotes.`)
}
const slices = (a.slices || []).filter(Boolean)

if (!slices.length) {
  const shape = `keys=[${Object.keys(a).join(',') || 'none'}]`
  if (!a.slug) throw new Error(`wave fanout: args is missing required wave fields (${shape}). Re-invoke the Workflow tool with the ENTIRE \`wave wave\` stdout JSON as the args object — a partial or paraphrased copy drops fields.`)
  log(`Wave is empty (${shape}) — graph drained, blocked, or only HITL remains.`)
  return { ran: [], halt_hitl: a.halt_hitl || [] }
}

function workdir(s) {
  return s.isolation === 'worktree' ? `${a.repo}/.plans/.worktrees/${a.slug}/${s.key}` : a.repo
}

function buildPrompt(s) {
  const dir = workdir(s)
  const place = s.isolation === 'worktree'
    ? `Work in the ISOLATED git worktree at ${dir} — it is a fresh checkout already created for you. Sibling slices in this wave run in their OWN worktrees in parallel; you will not see their changes. cd there first and stay inside it.`
    : `Work DIRECTLY in the repo at ${dir} (the main working tree). cd there first.`

  return `You are implementing ONE slice of the "${a.slug}" plan: ${s.key}.

${place}

Read these from disk BEFORE coding — they are the source of truth:
1. The slice spec: .plans/${a.slug}/slices/${s.key}.md  (what to build, acceptance criteria, which skills to load, how to validate)
2. .plans/${a.slug}/learnings.md if it exists — notes earlier slices left for you.

Load the skills the spec names and follow this project's CLAUDE.md / .claude/rules conventions.

Hard constraints:
- Implement the slice end to end and make every acceptance criterion in the spec actually pass.
- Run the validation steps the slice's spec lists (typecheck, tests, linters, and other) and read the output. Fix every error your changes introduced; warnings are ok.
- A slice is not done until its validation runs clean of new errors. If you cannot get it clean, set validationClean=false and explain why in notes, do not report it as passing.
- If the slice is too large to finish and verify in this single pass, stop, set validationClean=false, and say so in notes rather than committing a half-done slice. wave would rather you halt than land broken code.
${s.isolation === 'worktree'
  ? `- Only once validation is clean, COMMIT your finished work in this worktree (a single \`git commit\`, message "${s.key}"). Do NOT push and do NOT open a PR. wave lands it from the main tree.`
  : `- Do NOT commit, push, or open a PR. Leave your work as changes in the working tree — wave marks it done.`}
- You cannot do rendered-browser QA. Code + static validation only.

Return STRICT JSON per schema: the files you changed, a short summary, whether validation TRULY passed (you ran it and saw it clean), the exact validation commands you ran, and terse actionable learnings for the slices that follow (gotchas, interface contracts, decisions you made).`
}

const SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    changedFiles: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    validationClean: { type: 'boolean', description: 'true ONLY if you actually ran the spec validation and saw it pass clean' },
    validationCommands: { type: 'array', items: { type: 'string' }, description: 'the exact commands you ran to validate (empty if none ran)' },
    learnings: { type: 'string' },
    notes: { type: 'string', description: 'if validationClean is false, why' },
  },
  required: ['changedFiles', 'summary', 'validationClean', 'validationCommands'],
}

const runOne = s =>
  agent(buildPrompt(s), { label: s.key, phase: 'Run wave', schema: SCHEMA })
    .then(r => ({ key: s.key, isolation: s.isolation, result: r }))

phase('Run wave')

let waveResults
if (a.mode === 'inline') {
  log(`Wave: ${slices.map(s => s.key).join(' → ')} (inline, sequential)`)
  waveResults = []
  for (const s of slices) waveResults.push(await runOne(s))
} else {
  log(`Wave: ${slices.map(s => s.key).join(', ')} (${slices.length} parallel worktree${slices.length === 1 ? '' : 's'})`)
  waveResults = await parallel(slices.map(s => () => runOne(s)))
}

for (const wr of waveResults) {
  if (!wr || !wr.result) { log(`⚠ ${wr && wr.key} returned nothing — stays pending (not landed); its dependents stay blocked.`); continue }
  if (wr.result.validationClean === false) log(`⚠ ${wr.key} reported validationClean=false, do not land it as done. Reason: ${wr.result.notes || '(none given)'}`)
}

return {
  slug: a.slug,
  ran: waveResults.filter(r => r && r.result).map(r => r.key),
  halt_hitl: a.halt_hitl || [],
  results: waveResults,
}
