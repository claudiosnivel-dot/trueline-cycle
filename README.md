# ciclo

Plugin Claude Code che unisce due cose:

1. **BOOTSTRAP** — la generazione di blueprint tecnici con task atomici
   verificabili e il loro self-check (strutturale deterministico + semantico
   guidato), estratta dal progetto Trueline.
2. **Il loop di build** — un driver che esegue i macrotask del blueprint uno alla
   volta, ciascuno in una sessione Claude Code **nuova**, con oracoli
   deterministici e commit condizionato al verde.

Ragione d'essere: avere la sola **pianificazione + il loop** senza trascinarsi
dietro l'intera batteria di security review di Trueline. `ciclo` **non** contiene
le modalità BUILD e REMEDIATE di Trueline, né i suoi oracoli di sicurezza.
Funziona anche fuori dall'ecosistema Trueline (es. un'app iOS in Swift): la
conoscenza di *come si builda e si testa* uno stack la portano le **skill di
ecosistema installate nel progetto**; `ciclo` orchestra e delega.

## Requisiti

- **Node** (solo built-in, nessun `npm install`), **git**, **jq**.
- La CLI `claude` per il loop reale (il driver apre sessioni `claude -p`).

## Installazione

Il repo è un marketplace auto-ospitato. In sviluppo:

```sh
claude --plugin-dir /percorso/a/ciclo
# poi in Claude Code:  /help   → devono comparire /ciclo:blueprint, /ciclo:setup, /ciclo:stato
```

Oppure aggiungi il marketplace e installa il plugin `ciclo` da lì.

## Come si usa (il flusso)

I primi passi li fai **insieme al modello**, in una sessione interattiva:

1. `/ciclo:blueprint` — brainstorming + costruzione del blueprint + self-check
   (strutturale con `validate_blueprint.mjs`, semantico con la checklist) +
   emissione dei 3 prompt di lifecycle + istanza di `SESSION-STATE.md`.
2. `/ciclo:setup` — configura il loop sul progetto: rileva la sorgente, scrive
   `.cycle/`, scopre ed **esegue** i comandi di verifica reali, collega il driver,
   chiude con una prova `--dry-run`.

Poi il **ciclo continuo** gira **dal terminale** (non da dentro una sessione:
ogni suo ciclo apre una sessione nuova):

```sh
./.cycle/ciclo            # con gate umano prima di ogni build
./.cycle/ciclo --no-gate  # in autonomia
./.cycle/ciclo --dry-run  # percorre il flusso senza chiamare Claude
```

Per ogni macrotask il driver: apre una sessione nuova → esegue il prompt di inizio
→ costruisce il macrotask → esegue gli oracoli (con retry sull'**output grezzo**
fino a `MAX_FIX_ATTEMPTS`) → **commit (e push se `GIT_PUSH=1`) solo a verde** →
esegue il prompt di fine sessione (aggiorna `SESSION-STATE.md`) → chiude. Il
macrotask successivo apre una sessione nuova. Nessun `/clear`: il clear è
**eliminato**, non automatizzato; la continuità passa da `SESSION-STATE.md`.

`/ciclo:stato` riassume l'ultimo run dai log e segnala ogni divergenza fra ciò che
`SESSION-STATE.md` dichiara e ciò che i log dimostrano.

## Le due sorgenti del loop (`SOURCE`)

Stesso driver, due adapter (in `.cycle/config.sh`):

- **`trueline`** — coda e oracoli **derivati dal blueprint**. Gate zero:
  `validate_blueprint.mjs` deve uscire pulito, altrimenti il loop non parte. La
  coda è l'insieme dei **macrotask** in ordine di DAG (`depends_on`); gli oracoli
  di un macrotask sono i suoi `target_tests` eseguiti via `TEST_CMD`.
- **`manual`** — coda da `.cycle/tasks.txt`, oracoli dall'array `ORACLES` di
  `.cycle/config.sh`. È il percorso per i progetti fuori ecosistema.

In entrambi il verdetto di un oracolo è **l'exit code** (0 = passa): nessun
giudizio a parole di un modello conta come verifica.

### `.cycle/config.sh` (estratto)

```sh
SOURCE="trueline"            # trueline | manual
BLUEPRINT_DIR="blueprint"    # (trueline) dir della suite
TEST_CMD="npx vitest run"    # (trueline) runner; riceve i file target_tests come argomenti
ORACLES=( "npm run lint" "npm test" )   # (manual) verdetto = exit code
GATE=1                       # conferma umana prima di ogni build
GIT_PUSH=0                   # push dopo il commit verde
MAX_FIX_ATTEMPTS=3
ECOSYSTEM="ios-swift"        # informativo; build/test delegati alle skill del progetto
```

## L'ecosistema

`ciclo` **non risolve l'ecosistema automaticamente** (nessun resolver, nessuna
guida per-ecosistema importata da Trueline). Lo stack è un campo `ECOSYSTEM`
dichiarato, e il comando di test lo dichiari in `TEST_CMD`/`ORACLES`: è l'unica
cosa che scrivi a mano, e la scrivi una volta. Vedi `docs/upstream/VENDOR.md` per
le due deviazioni intenzionali rispetto a `bootstrap.md` (che, copiato verbatim,
cita ancora il resolver).

## Provenienza

Il cuore di BOOTSTRAP è **copiato verbatim** da Trueline (non riscritto):
`references/`, `assets/prompts/`, `scripts/blueprint/`. Ogni file, la sua origine
e il commit SHA sono in [`docs/upstream/VENDOR.md`](docs/upstream/VENDOR.md), con
il comando per rifare la risincronizzazione. La specifica di riferimento è in
`docs/upstream/` (`11-BLUEPRINT-ENGINE.md`, `12-LIFECYCLE-PROMPTS.md`).

## Struttura

```
.claude-plugin/  manifest + marketplace auto-ospitato
commands/        /ciclo:blueprint, /ciclo:setup, /ciclo:stato
bin/             ciclo (driver del loop) + ciclo-queue.mjs (adapter → coda + oracoli)
hooks/           SessionStart: inietta contesto nelle sessioni interattive
references/      copiato da Trueline (runtime di BOOTSTRAP)
assets/prompts/  copiato da Trueline (i 3 prompt di lifecycle)
scripts/blueprint/ copiato da Trueline (validate_blueprint + dipendenze + test)
templates/       config e coda per SOURCE=manual
docs/upstream/   specifica di riferimento + VENDOR.md
```

## Test

I test degli script vendorizzati (built-in `node:test`):

```sh
node --test scripts/blueprint/*.test.mjs
```

## Possibili evoluzioni

*(Idee non implementate — annotate qui per scelta, non fanno parte dello scope
attuale.)*

- Portare opzionalmente il resolver di ecosistema di Trueline come modalità
  aggiuntiva, se un giorno servisse la detection automatica dello stack.
- Un `TEST_CMD` con mappatura per-runner incorporata (es. `--filter` per stack che
  non accettano path di file), invece del wrapper a carico dell'utente.
- Parallelizzazione di macrotask indipendenti nel DAG (oggi la coda è sequenziale).
- Un riepilogo HTML del run per `/ciclo:stato`.
