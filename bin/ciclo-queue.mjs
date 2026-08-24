#!/usr/bin/env node
// ciclo-queue.mjs — adapter blueprint → coda + oracoli (D-005).
//
// Node ESM, SOLO built-in (D-006). Non stampa nulla su stdout tranne il JSON
// finale, così il driver lo può consumare con jq. Diagnostica su stderr.
//
// Due sorgenti (D-005), stesso output:
//   --source trueline : coda derivata dal blueprint; gate zero con
//                       validate_blueprint.mjs (se rosso, ok:false e il loop non
//                       parte). Oracoli per macrotask = il comando di test del
//                       progetto ($TEST_CMD) invocato sui file target_tests del
//                       macrotask. Il verdetto resta l'exit code (D-001).
//   --source manual   : coda da .cycle/tasks.txt; oracoli dall'array ORACLES di
//                       .cycle/config.sh (serializzato in un file dal driver).
//
// Output (stdout, JSON):
//   OK:   { source, ok:true, queue:[ { macrotask, tasks:[id...], oracles:[cmd...] } ] }
//   Gate: { source, ok:false, gate:"validate_blueprint", exit:N, report:"..." }
//   Err:  { source, ok:false, error:"..." }

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- arg parsing -------------------------------------------------------------
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      // Sentinella per "flag senza valore" = boolean true (NON la stringa 'true',
      // così un valore legittimo "true" — es. TEST_CMD=true — resta valido).
      const val = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      o[key] = val;
    }
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
const source = args.source || 'trueline';

function out(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }
// L'adapter di per sé è "riuscito" a produrre un verdetto: l'esito sta in obj.ok,
// il driver decide. Non usiamo exit code per distinguere gate rosso da errore.

// --- util: quoting shell POSIX per i path ------------------------------------
const shq = (s) => `'` + String(s).replace(/'/g, `'\\''`) + `'`;

// --- util: righe utili di un file (no vuote, no commenti #) -------------------
function usefulLines(path) {
  if (typeof path !== 'string' || !existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

function buildManual() {
  const tasks = usefulLines(args['tasks-file']);
  const oracles = usefulLines(args['oracles-file']);
  if (tasks.length === 0) return { source, ok: false, error: 'coda vuota: nessuna riga utile in .cycle/tasks.txt' };
  if (oracles.length === 0) return { source, ok: false, error: 'nessun oracolo: array ORACLES vuoto in .cycle/config.sh' };
  const queue = tasks.map((line) => ({ macrotask: line, tasks: [], oracles: oracles.slice() }));
  return { source, ok: true, queue };
}

async function buildTrueline() {
  const blueprintDir = typeof args['blueprint-dir'] === 'string'
    ? resolve(args['blueprint-dir']) : null;
  if (!blueprintDir || !existsSync(blueprintDir)) {
    return { source, ok: false, error: `blueprint dir inesistente: ${args['blueprint-dir'] || '(non passato)'}` };
  }
  const testCmd = typeof args['test-cmd'] === 'string' ? args['test-cmd'] : '';
  if (!testCmd) return { source, ok: false, error: 'TEST_CMD mancante: serve il comando di test del progetto (SOURCE=trueline)' };

  // --- Gate zero: validate_blueprint.mjs (oracolo strutturale, D-001) --------
  const validateScript = typeof args['validate-script'] === 'string'
    ? resolve(args['validate-script'])
    : resolve(__dirname, '..', 'scripts', 'blueprint', 'validate_blueprint.mjs');
  if (!existsSync(validateScript)) return { source, ok: false, error: `validate_blueprint.mjs non trovato: ${validateScript}` };

  const gate = spawnSync(process.execPath, [validateScript, blueprintDir], { encoding: 'utf8' });
  if (gate.status !== 0) {
    return { source, ok: false, gate: 'validate_blueprint', exit: gate.status,
      report: (gate.stdout || '') + (gate.stderr || '') };
  }

  // --- Coda: loadTasks → raggruppa per macrotask → ordina per DAG ------------
  let loadTasks;
  try {
    ({ loadTasks } = await import('../scripts/blueprint/blueprint_tasks.mjs'));
  } catch (e) {
    return { source, ok: false, error: `import di blueprint_tasks.mjs fallito: ${e.message}` };
  }

  let tasks;
  try { tasks = loadTasks(blueprintDir); }
  catch (e) { return { source, ok: false, error: `loadTasks ha lanciato: ${e.message}` }; }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { source, ok: false, error: `nessun task atomico trovato in ${blueprintDir}` };
  }

  // mappa id → macrotask
  const id2macro = new Map();
  for (const t of tasks) if (t.id && t.macrotask) id2macro.set(t.id, t.macrotask);

  // macrotask in ordine di prima comparsa (tiebreak stabile)
  const order = [];
  const seen = new Set();
  for (const t of tasks) {
    if (t.macrotask && !seen.has(t.macrotask)) { seen.add(t.macrotask); order.push(t.macrotask); }
  }

  // archi macrotask→macrotask da depends_on a livello di task
  const adj = new Map(order.map((m) => [m, new Set()]));
  const indeg = new Map(order.map((m) => [m, 0]));
  for (const t of tasks) {
    const to = t.macrotask;
    for (const dep of (t.depends_on || [])) {
      const from = id2macro.get(dep);
      if (from && from !== to && adj.has(from) && !adj.get(from).has(to)) {
        adj.get(from).add(to);
        indeg.set(to, indeg.get(to) + 1);
      }
    }
  }

  // Kahn con tiebreak sull'ordine di prima comparsa
  const ready = order.filter((m) => indeg.get(m) === 0);
  const sorted = [];
  while (ready.length) {
    ready.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const m = ready.shift();
    sorted.push(m);
    for (const nxt of adj.get(m)) {
      indeg.set(nxt, indeg.get(nxt) - 1);
      if (indeg.get(nxt) === 0) ready.push(nxt);
    }
  }
  if (sorted.length !== order.length) {
    const stuck = order.filter((m) => !sorted.includes(m));
    return { source, ok: false, error: `ciclo fra macrotask nel DAG depends_on (coinvolti: ${stuck.join(', ')})` };
  }

  // per macrotask: task id + file di test distinti → un oracolo per file
  const filesByMacro = new Map(order.map((m) => [m, []]));
  const tasksByMacro = new Map(order.map((m) => [m, []]));
  for (const t of tasks) {
    tasksByMacro.get(t.macrotask).push(t.id);
    for (const tt of (t.target_tests || [])) {
      if (tt.file && !filesByMacro.get(t.macrotask).includes(tt.file)) {
        filesByMacro.get(t.macrotask).push(tt.file);
      }
    }
  }

  const queue = sorted.map((m) => {
    const files = filesByMacro.get(m);
    const oracles = files.length ? files.map((f) => `${testCmd} ${shq(f)}`) : [testCmd];
    return { macrotask: m, tasks: tasksByMacro.get(m), oracles };
  });

  return { source, ok: true, queue };
}

async function main() {
  if (source === 'manual') return buildManual();
  if (source === 'trueline') return buildTrueline();
  return { source, ok: false, error: `SOURCE sconosciuto: "${source}" (attesi: trueline | manual)` };
}

main().then(out).catch((e) => out({ source, ok: false, error: `adapter crash: ${e && e.message}` }));
