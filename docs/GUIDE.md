<!--
  Guida pratica al plugin ciclo — bilingue.
  Practical guide to the ciclo plugin — bilingual.
-->

# Guida a `ciclo` / `ciclo` Guide

**[🇮🇹 Italiano](#-italiano) · [🇬🇧 English](#-english)**

---

# 🇮🇹 Italiano

Guida pratica **dettagliata** all'uso del plugin `ciclo`. Se è la prima volta,
leggi nell'ordine: *Modello mentale* → *Installazione* → *Il flusso in 4 fasi* →
*Esempi concreti*. Le sezioni *Riferimento* e *FAQ* servono dopo, alla bisogna.

## Indice

1. [Modello mentale](#1-modello-mentale)
2. [Requisiti](#2-requisiti)
3. [Installazione](#3-installazione)
4. [Il flusso in 4 fasi](#4-il-flusso-in-4-fasi)
   - [Fase 1 — `/ciclo:blueprint`](#fase-1--cicloblueprint-pianificare)
   - [Fase 2 — `/ciclo:setup`](#fase-2--ciclosetup-configurare-il-loop)
   - [Fase 3 — lanciare il loop](#fase-3--lanciare-il-loop-dal-terminale)
   - [Fase 4 — `/ciclo:stato`](#fase-4--ciclostato-controllare)
5. [Esempi concreti](#5-esempi-concreti)
6. [Riferimento: `.cycle/config.sh`](#6-riferimento-cycleconfigsh)
7. [Riferimento: come funzionano gli oracoli](#7-riferimento-come-funzionano-gli-oracoli)
8. [Riferimento: i log di un run](#8-riferimento-i-log-di-un-run)
9. [Il formato del blueprint](#9-il-formato-del-blueprint)
10. [Ecosistemi e delega di build/test](#10-ecosistemi-e-delega-di-buildtest)
11. [Le decisioni di progetto (D-001…D-006)](#11-le-decisioni-di-progetto)
12. [FAQ e risoluzione problemi](#12-faq-e-risoluzione-problemi)
13. [Glossario](#13-glossario)

---

## 1. Modello mentale

`ciclo` risolve un problema pratico: oggi sei **tu** a lanciare a mano, sessione
dopo sessione, "esegui il prompt di inizio", "esegui il prompt di fine", e il
`clear` per ripulire il contesto. `ciclo` automatizza questo ritmo.

Fa due cose, tenute separate di proposito:

- **Pianificazione (BOOTSTRAP)** — genera un *blueprint* tecnico: un piano
  scomposto in **macrotask**, ognuno con **task atomici** che portano
  obbligatoriamente `definition_of_done`, `acceptance_criteria` e `target_tests`.
  Il piano passa un **self-check strutturale deterministico** (uno script che esce
  0/1) e un **self-check semantico guidato** (una checklist). Questa metà è
  **copiata verbatim** dal progetto Trueline.
- **Loop di build** — un *driver* che gira **nel terminale** ed esegue i macrotask
  uno alla volta. Ogni macrotask apre una **sessione Claude Code nuova**,
  costruisce, verifica con **oracoli deterministici**, e **committa solo se
  l'oracolo è verde**.

Tre idee chiave, non negoziabili:

- **L'oracolo è un comando, non un'opinione.** Un oracolo esce `0` se passa,
  diverso da `0` se fallisce. Nessun giudizio "a parole" di un modello conta come
  verifica (D-001).
- **Niente `clear`.** Il clear non è automatizzato: è **eliminato**. Ogni
  macrotask è un **processo nuovo**, quindi parte già con il contesto pulito
  (D-002).
- **La continuità passa da `SESSION-STATE.md`**, non dal contesto (D-003). La
  sessione nuova legge lì dov'era arrivato il lavoro e riparte.

Cosa `ciclo` **non** fa: non contiene le modalità **BUILD** e **REMEDIATE** di
Trueline né i suoi oracoli di sicurezza; e **non sa** come si builda/testa uno
stack specifico (iOS, Android, …). Quella conoscenza la portano le **skill di
ecosistema** che installi nel progetto; `ciclo` le aggancia tramite il comando di
test che dichiari in configurazione.

## 2. Requisiti

- **Node** (usa solo i moduli built-in: nessun `npm install`), **git**, **jq**.
- La CLI **`claude`** per il loop reale (il driver apre sessioni `claude -p`).

Verifica veloce:

```sh
node --version && git --version && jq --version && claude --version
```

## 3. Installazione

### A. In sviluppo, senza installare (il più rapido per provare)

```sh
claude --plugin-dir /percorso/a/ciclo
```

Poi in Claude Code digita `/help`: devono comparire `/ciclo:blueprint`,
`/ciclo:setup`, `/ciclo:stato`.

### B. Come marketplace auto-ospitato (installazione persistente)

```sh
# aggiungi il marketplace dalla cartella del plugin
claude plugin marketplace add /percorso/a/ciclo
# installa il plugin
claude plugin install ciclo@ciclo
# verifica
claude plugin list
claude plugin details ciclo     # mostra i 3 comandi e l'hook SessionStart
```

Per disinstallare / rimuovere:

```sh
claude plugin uninstall ciclo@ciclo
claude plugin marketplace remove ciclo
```

> **Nota.** All'avvio di una sessione interattiva in un progetto `ciclo`, un hook
> `SessionStart` inietta un promemoria (leggi `SESSION-STATE.md`, comandi
> disponibili, come si lancia il loop). Quando la sessione la apre il driver del
> loop, l'hook si **disattiva** (il contesto è già nel prompt).

## 4. Il flusso in 4 fasi

Le prime due fasi le fai **in chat, insieme al modello**. La terza gira **nel
terminale**. La quarta è un controllo.

```
  (chat)                         (terminale)              (chat)
  Fase 1            Fase 2         Fase 3                  Fase 4
  /ciclo:blueprint  /ciclo:setup   ./.cycle/ciclo          /ciclo:stato
  pianifica    →    configura   →  LOOP autonomo:       →  controlla l'esito
                                   per ogni macrotask:
                                   sessione nuova →
                                   build → oracoli →
                                   commit se verde →
                                   fine → ricomincia
```

### Fase 1 — `/ciclo:blueprint` (pianificare)

In una sessione interattiva, lancia `/ciclo:blueprint`. Il comando esegue la
pipeline di BOOTSTRAP:

1. **Brainstorming / raccolta intento** — obiettivo del progetto, `ECOSYSTEM`
   (lo stack), vincoli noti. **Gli input sono i tuoi**: il modello non inventa
   vincoli non dichiarati.
2. **Generazione del blueprint** dai template, nella cartella `blueprint/` alla
   root del progetto: `00-INDEX.md`, `VISION-AND-CONSTRAINTS.md`, e moduli
   numerati `01-….md`, `02-….md` (un modulo = un macrotask). Ogni task atomico
   porta `definition_of_done` + `acceptance_criteria` + `target_tests`.
3. **Self-check strutturale (oracolo)** — esegue `validate_blueprint.mjs` sulla
   cartella. Controlla: campi obbligatori, ogni criterio coperto da ≥1 test, DAG
   `depends_on` aciclico, id univoci, ownership del macrotask. **Deve uscire
   pulito**; se è rosso, il blueprint è rifiutato e si corregge.
4. **Self-check semantico** — la checklist (punti 6–10): misurabilità, atomicità,
   copertura, baseline di sicurezza, niente task fantasma. Solleva **rilievi**.
5. **Rilievi all'utente** — i rilievi si **propongono a te**, non si applicano di
   nascosto. Il blueprint si chiude dopo la tua conferma.
6. **Emissione dei 3 prompt di lifecycle** parametrizzati (`project-start`,
   `session-start`, `session-end`) in `.cycle/prompts/`.
7. **Istanza di `SESSION-STATE.md`** alla root: stato iniziale, nessun macrotask
   costruito.

Al termine hai: `blueprint/`, `.cycle/prompts/`, `SESSION-STATE.md`.

### Fase 2 — `/ciclo:setup` (configurare il loop)

Lancia `/ciclo:setup`. Il comando:

1. **Rileva `SOURCE`** — se esiste `blueprint/` con moduli → `trueline`;
   altrimenti → `manual`.
2. **Scrive `.cycle/config.sh`** dal template.
3. **Determina gli oracoli — eseguendoli davvero.**
   - `trueline`: ti aiuta a fissare `TEST_CMD`, il comando di test del progetto, e
     lo **esegue** una volta per verificare che parta. Non lo inventa.
   - `manual`: ispeziona `package.json`, `Makefile`, workflow CI, config dei
     linter; per **ogni** candidato lo **esegue**; tiene solo quelli che partono,
     scarta gli altri. Se non trova nessun oracolo eseguibile, si ferma e te lo
     dice (senza oracoli il loop non può committare condizionato al verde).
4. **Aggiunge `.cycle/logs/` a `.gitignore`.**
5. **Collega il driver**: crea `.cycle/ciclo`, un piccolo wrapper eseguibile che
   punta al driver del plugin.
6. **Chiude con una prova `--dry-run`**: `./.cycle/ciclo --dry-run` deve mostrare
   la coda ed uscire 0.

### Fase 3 — lanciare il loop (dal terminale)

> ⚠️ **Il loop NON si lancia da dentro una sessione di chat.** Gira nel terminale,
> perché ogni suo ciclo apre una sessione nuova. Una sessione non può riavviare
> se stessa dall'interno: lo fa il driver esterno.

Dalla root del progetto:

```sh
./.cycle/ciclo            # con gate umano: chiede conferma prima di ogni build
./.cycle/ciclo --no-gate  # in autonomia: nessuna conferma, va da solo
./.cycle/ciclo --dry-run  # prova a secco: percorre il flusso SENZA chiamare Claude
./.cycle/ciclo -h         # aiuto
```

Cosa fa per **ogni macrotask** della coda:

1. apre una sessione nuova (`claude -p --output-format json`) e ne cattura il
   `session_id`;
2. (se il gate è attivo) ti chiede conferma;
3. **build** del macrotask (`claude -r <sid> -p …`);
4. esegue gli **oracoli**; se sono rossi rimanda a Claude l'**output grezzo** — non
   un riassunto — e ritenta fino a `MAX_FIX_ATTEMPTS`;
5. **commit** (e `git push` se `GIT_PUSH=1`) **solo** se gli oracoli sono verdi;
6. esegue il **prompt di fine sessione** che aggiorna `SESSION-STATE.md`;
7. chiude il processo. Il macrotask successivo apre una **sessione nuova**.

Un macrotask fallito **non ferma la coda**, ma il driver esce **non-zero** se
almeno uno è fallito. Ogni run scrive log dettagliati in `.cycle/logs/<timestamp>/`.

### Fase 4 — `/ciclo:stato` (controllare)

In chat, `/ciclo:stato` riassume l'ultimo run **dai log** e — punto importante —
segnala **ogni divergenza** fra ciò che `SESSION-STATE.md` dichiara completato e
ciò che i log **dimostrano** (oracoli verdi/rossi, commit reali). Non corregge
nulla: osserva e segnala.

## 5. Esempi concreti

### Esempio A — app iOS/Swift con blueprint (SOURCE=trueline)

```text
# in Claude Code:
/ciclo:blueprint
  → stack: ios-swift; obiettivo e vincoli li dai tu
  → genera blueprint/, .cycle/prompts/, SESSION-STATE.md
/ciclo:setup
  → rileva SOURCE=trueline
  → TEST_CMD: iOS non prende path di file direttamente, quindi usiamo un wrapper.
```

`.cycle/config.sh` (estratto) per iOS:

```sh
SOURCE="trueline"
BLUEPRINT_DIR="blueprint"
TEST_CMD="./.cycle/run-tests.sh"   # wrapper: riceve i file e li traduce per xcodebuild
ECOSYSTEM="ios-swift"
GATE=1
GIT_PUSH=0
MAX_FIX_ATTEMPTS=3
```

Esempio di wrapper `.cycle/run-tests.sh` (lo scrivi tu, una volta):

```sh
#!/usr/bin/env bash
# Riceve i file target_tests come argomenti; li mappa a -only-testing per xcodebuild.
set -euo pipefail
args=()
for f in "$@"; do
  # esempio: mappa un path di file di test allo scheme/target; adatta al tuo progetto
  args+=( -only-testing "MyAppTests/$(basename "$f" .swift)" )
done
exec xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 15' "${args[@]}"
```

Poi, dal terminale:

```sh
./.cycle/ciclo --dry-run     # controlla la coda
./.cycle/ciclo               # con gate, per le prime volte
# quando ti fidi:
./.cycle/ciclo --no-gate
```

### Esempio B — progetto qualunque, coda a mano (SOURCE=manual)

Utile quando non c'è un blueprint (o non lo vuoi usare per il loop).

`.cycle/tasks.txt` (una riga = un'unità di lavoro):

```text
Schermata di login con validazione
Lista prenotazioni con pull-to-refresh
Sincronizzazione offline
```

`.cycle/config.sh` (estratto):

```sh
SOURCE="manual"
ORACLES=(
  "npm run lint"
  "npm test"
)
GATE=1
GIT_PUSH=0
MAX_FIX_ATTEMPTS=3
```

Gli oracoli (`ORACLES`) sono gli stessi per ogni riga: dopo il build di ciascuna
unità, il loop li esegue tutti; verde solo se tutti escono 0.

## 6. Riferimento: `.cycle/config.sh`

È uno script bash che il driver "source"-a. Campi:

| Campo | Sorgente | Significato |
|---|---|---|
| `SOURCE` | entrambe | `trueline` (coda dal blueprint) o `manual` (coda da `tasks.txt`). |
| `BLUEPRINT_DIR` | trueline | Cartella della suite di blueprint (default `blueprint`). |
| `TEST_CMD` | trueline | Comando di test del progetto. Riceve i file `target_tests` del macrotask come **argomenti**. |
| `ORACLES` | manual | Array di comandi shell; verdetto = exit code. Vuoto = il loop rifiuta di partire. |
| `SESSION_STATE` | entrambe | Percorso dello stato vivo (default `SESSION-STATE.md`). |
| `GATE` | entrambe | `1` = conferma umana prima di ogni build. `--no-gate` la spegne per quel run. |
| `GIT_PUSH` | entrambe | `1` = `git push` dopo il commit verde. |
| `MAX_FIX_ATTEMPTS` | entrambe | Tentativi di fix (con output grezzo) prima di arrendersi su un macrotask. |
| `ECOSYSTEM` | entrambe | Informativo (es. `ios-swift`). `ciclo` delega build/test alle skill del progetto. |

## 7. Riferimento: come funzionano gli oracoli

- **Regola d'oro (D-001)**: l'oracolo è un comando; il verdetto è il suo **exit
  code**. `0` = verde (passa), diverso da `0` = rosso (fallisce).
- **`SOURCE=trueline`**: per ogni macrotask, `ciclo` prende i file `target_tests`
  dei suoi task atomici e li dà a `TEST_CMD` **come argomenti**, un oracolo per
  file: `TEST_CMD '<file>'`. Per runner che accettano path (pytest, jest, go
  test, vitest) funziona diretto. Per stack che **non** li accettano (es. iOS),
  usa un wrapper come nell'Esempio A.
- **`SOURCE=manual`**: gli oracoli sono l'array `ORACLES`, eseguiti in ordine dopo
  ogni build; verde solo se **tutti** escono 0.
- **Retry con output grezzo**: se gli oracoli sono rossi, `ciclo` rimanda a Claude
  l'**output integrale** (non un riassunto) e ritenta fino a `MAX_FIX_ATTEMPTS`.
  Se restano rossi, **niente commit** e il macrotask è segnato come fallito.

## 8. Riferimento: i log di un run

Ogni run crea `.cycle/logs/<timestamp>/`:

```
.cycle/logs/20260824-205127/
├── queue.json                 la coda calcolata (macrotask, task, oracoli)
├── oracles.manual.txt         (solo manual) l'array ORACLES serializzato
└── 00-<slug-macrotask>/
    ├── session.json           l'output --output-format json (contiene session_id)
    ├── session.err            stderr dell'apertura sessione
    ├── build.log              output del turno di build
    ├── oracles.attempt-0.log  primo giro di oracoli (righe ### exit 0/non-zero)
    ├── fix-1.log              1° tentativo di correzione (se servito)
    ├── oracles.attempt-1.log  oracoli dopo il 1° fix
    ├── …                      fino a MAX_FIX_ATTEMPTS
    └── session-end.log        chiusura sessione (aggiornamento SESSION-STATE)
```

`/ciclo:stato` legge proprio questi file. Nota: `.cycle/logs/` è in `.gitignore`.

## 9. Il formato del blueprint

Un modulo (`blueprint/NN-….md`) contiene i task atomici in blocchi ```yaml```.
Schema minimo di un task (campi obbligatori controllati dall'oracolo strutturale):

```yaml
- id: T-014                       # univoco, stabile
  title: "…"
  macrotask: "prenotazioni"       # ownership, non vuoto
  depends_on: [T-009, T-011]      # DAG, niente cicli, no id inesistenti
  objective: >
    Cosa deve ottenere (prosa).
  definition_of_done:             # osservabile: "il lavoro c'è"
    - "…"
  acceptance_criteria:            # testabile: "fa la cosa giusta"
    - id: AC-014-1
      given: "…"
      when: "…"
      then: "…"
  target_tests:                   # i criteri resi eseguibili
    - file: "tests/bookings.create.test.ts"
      covers: [AC-014-1]
  security_notes:                 # opzionale
    - "…"
```

La coda del loop (in `trueline`) è l'insieme dei **macrotask** ordinati per DAG
`depends_on`; gli oracoli di un macrotask sono i suoi `target_tests`. Puoi
validare a mano un blueprint:

```sh
node scripts/blueprint/validate_blueprint.mjs blueprint
```

## 10. Ecosistemi e delega di build/test

`ciclo` **non** risolve l'ecosistema automaticamente (nessun resolver, nessuna
guida per-ecosistema importata). Lo stack è un campo `ECOSYSTEM` dichiarato, e il
*come si testa* lo dichiari in `TEST_CMD`/`ORACLES`. Il *come si builda* lo portano
le **skill di ecosistema** che installi nel progetto: dentro ogni sessione del
loop, il modello le usa per costruire il macrotask. È l'unico pezzo che scrivi a
mano, e lo scrivi una volta.

> Il file `references/modes/bootstrap.md`, copiato verbatim da Trueline, cita
> ancora un resolver di ecosistema e una `guide.md`: sono due riferimenti
> **orfani** in `ciclo`, documentati in [`VENDOR.md`](upstream/VENDOR.md). Il
> comando `/ciclo:blueprint` li ignora e usa `ECOSYSTEM` dichiarato.

## 11. Le decisioni di progetto

| ID | Decisione |
|---|---|
| **D-001** | L'oracolo è un comando: exit `0` = passa. Nessun verdetto a parole conta come verifica. |
| **D-002** | Il loop gira **fuori** dalla sessione: `claude -p` per macrotask. Nessun `/clear`: è eliminato, non automatizzato. |
| **D-003** | La continuità fra cicli passa da `SESSION-STATE.md`, mai dal contesto. |
| **D-004** | I file presi da Trueline sono **copiati verbatim** e tracciati in `VENDOR.md` con il commit SHA d'origine. |
| **D-005** | Due sorgenti per il loop: `trueline` (dal blueprint) e `manual` (da config). Stesso driver, due adapter. |
| **D-006** | Zero dipendenze runtime oltre Node (built-in), `git`, `jq`. Nessun `npm install`. |

## 12. FAQ e risoluzione problemi

**Il loop non parte e stampa un "GATE ZERO fallito".**
Il blueprint non passa il self-check strutturale. Il report dice quale controllo è
caduto (es. `T-010: manca acceptance_criteria`). Correggi il blueprint e riprova.
Il loop **non parte** finché il piano non è valido — è voluto.

**"manca .cycle/config.sh — esegui /ciclo:setup".**
Non hai ancora configurato il loop su questo progetto. Lancia `/ciclo:setup`.

**"GATE attivo ma nessun /dev/tty".**
Stai lanciando il loop in un contesto senza terminale interattivo con il gate
acceso. Usa `--no-gate` per l'esecuzione autonoma.

**"nessun oracolo: array ORACLES vuoto".**
In `manual`, `ORACLES` è vuoto. Senza oracoli non c'è verifica, quindi niente
commit condizionato: aggiungi almeno un comando provato (`/ciclo:setup` li scopre
ed esegue per te).

**Un oracolo verde ma "git commit non ha prodotto nulla".**
Il build non ha cambiato file (working tree pulito). Non è un errore del loop:
non c'era nulla da committare.

**Il mio runner di test non accetta path di file (es. iOS).**
Usa un wrapper come `TEST_CMD` (Esempio A) che traduce i file negli argomenti del
tuo runner. `/ciclo:setup` esegue il comando prima di scriverlo, quindi un
`TEST_CMD` rotto si vede subito.

**Voglio il push automatico.**
Metti `GIT_PUSH=1` in `.cycle/config.sh`. Il push avviene solo dopo un commit
verde.

**Come rieseguo i test degli script del plugin?**
`node --test scripts/blueprint/*.test.mjs`.

**(Avanzato) Testare il driver senza chiamare l'API.**
Il driver rispetta `CICLO_CLAUDE_BIN` per sovrascrivere il binario `claude`
(utile per test end-to-end con uno stub). Default: `claude`.

## 13. Glossario

- **Blueprint** — il piano tecnico: macrotask + task atomici verificabili.
- **Macrotask** — l'unità della coda del loop e del commit atomico.
- **Task atomico** — la più piccola unità del piano, con DoD + AC + target_tests.
- **Oracolo** — un comando che decide passa/fallisce via exit code (D-001).
- **Gate zero** — il self-check strutturale che deve essere verde prima che il
  loop parta.
- **Gate umano** — la conferma prima di ogni build (`GATE=1`, `--no-gate` la toglie).
- **SESSION-STATE.md** — lo stato vivo del progetto, fonte di continuità (D-003).

---
---

# 🇬🇧 English

A **detailed** practical guide to the `ciclo` plugin. First time? Read in order:
*Mental model* → *Installation* → *The 4-phase flow* → *Worked examples*. The
*Reference* and *FAQ* sections are for later, as needed.

## Table of contents

1. [Mental model](#1-mental-model)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [The 4-phase flow](#4-the-4-phase-flow)
   - [Phase 1 — `/ciclo:blueprint`](#phase-1--cicloblueprint-plan)
   - [Phase 2 — `/ciclo:setup`](#phase-2--ciclosetup-configure-the-loop)
   - [Phase 3 — run the loop](#phase-3--run-the-loop-from-the-terminal)
   - [Phase 4 — `/ciclo:stato`](#phase-4--ciclostato-inspect)
5. [Worked examples](#5-worked-examples)
6. [Reference: `.cycle/config.sh`](#6-reference-cycleconfigsh)
7. [Reference: how oracles work](#7-reference-how-oracles-work)
8. [Reference: a run's logs](#8-reference-a-runs-logs)
9. [The blueprint format](#9-the-blueprint-format)
10. [Ecosystems and build/test delegation](#10-ecosystems-and-buildtest-delegation)
11. [Design decisions (D-001…D-006)](#11-design-decisions)
12. [FAQ and troubleshooting](#12-faq-and-troubleshooting)
13. [Glossary](#13-glossary)

---

## 1. Mental model

`ciclo` solves a practical problem: today **you** manually run, session after
session, "run the start prompt", "run the end prompt", and `clear` to wipe
context. `ciclo` automates that rhythm.

It does two things, deliberately kept apart:

- **Planning (BOOTSTRAP)** — generates a technical *blueprint*: a plan broken into
  **macrotasks**, each with **atomic tasks** that mandatorily carry
  `definition_of_done`, `acceptance_criteria`, and `target_tests`. The plan passes
  a **deterministic structural self-check** (a script that exits 0/1) and a
  **guided semantic self-check** (a checklist). This half is **copied verbatim**
  from the Trueline project.
- **Build loop** — a *driver* that runs **in the terminal** and executes
  macrotasks one at a time. Each macrotask opens a **fresh Claude Code session**,
  builds, verifies with **deterministic oracles**, and **commits only if the
  oracle is green**.

Three non-negotiable ideas:

- **An oracle is a command, not an opinion.** It exits `0` if it passes, non-zero
  if it fails. No model's worded verdict counts as verification (D-001).
- **No `clear`.** Clearing isn't automated — it's **removed**. Each macrotask is a
  **new process**, so it starts with clean context (D-002).
- **Continuity flows through `SESSION-STATE.md`**, not through context (D-003).
  The new session reads where the work stood and resumes.

What `ciclo` does **not** do: it does not include Trueline's **BUILD** and
**REMEDIATE** modes or its security oracles; and it does **not** know how to
build/test a specific stack (iOS, Android, …). That knowledge comes from the
**ecosystem skills** you install in the project; `ciclo` hooks into them via the
test command you declare in configuration.

## 2. Requirements

- **Node** (built-in modules only: no `npm install`), **git**, **jq**.
- The **`claude`** CLI for the real loop (the driver opens `claude -p` sessions).

Quick check:

```sh
node --version && git --version && jq --version && claude --version
```

## 3. Installation

### A. In development, without installing (fastest to try)

```sh
claude --plugin-dir /path/to/ciclo
```

Then type `/help` in Claude Code: you should see `/ciclo:blueprint`,
`/ciclo:setup`, `/ciclo:stato`.

### B. As a self-hosted marketplace (persistent install)

```sh
# add the marketplace from the plugin folder
claude plugin marketplace add /path/to/ciclo
# install the plugin
claude plugin install ciclo@ciclo
# verify
claude plugin list
claude plugin details ciclo     # shows the 3 commands and the SessionStart hook
```

To uninstall / remove:

```sh
claude plugin uninstall ciclo@ciclo
claude plugin marketplace remove ciclo
```

> **Note.** When an interactive session starts in a `ciclo` project, a
> `SessionStart` hook injects a reminder (read `SESSION-STATE.md`, available
> commands, how to run the loop). When the loop driver opens the session, the hook
> **disables itself** (the context is already in the prompt).

## 4. The 4-phase flow

The first two phases happen **in chat, together with the model**. The third runs
**in the terminal**. The fourth is a check.

```
  (chat)                         (terminal)              (chat)
  Phase 1           Phase 2        Phase 3                 Phase 4
  /ciclo:blueprint  /ciclo:setup   ./.cycle/ciclo          /ciclo:stato
  plan         →    configure   →  AUTONOMOUS loop:     →  inspect the outcome
                                   for each macrotask:
                                   fresh session →
                                   build → oracles →
                                   commit if green →
                                   end → repeat
```

### Phase 1 — `/ciclo:blueprint` (plan)

In an interactive session, run `/ciclo:blueprint`. It runs the BOOTSTRAP pipeline:

1. **Brainstorming / intent gathering** — project goal, `ECOSYSTEM` (the stack),
   known constraints. **The inputs are yours**: the model does not invent
   undeclared constraints.
2. **Blueprint generation** from templates, into the `blueprint/` folder at the
   project root: `00-INDEX.md`, `VISION-AND-CONSTRAINTS.md`, and numbered modules
   `01-….md`, `02-….md` (one module = one macrotask). Every atomic task carries
   `definition_of_done` + `acceptance_criteria` + `target_tests`.
3. **Structural self-check (oracle)** — runs `validate_blueprint.mjs` on the
   folder. It checks: required fields, every criterion covered by ≥1 test, acyclic
   `depends_on` DAG, unique ids, macrotask ownership. It **must exit clean**; if
   red, the blueprint is rejected and you fix it.
4. **Semantic self-check** — the checklist (points 6–10): measurability,
   atomicity, coverage, security baseline, no phantom tasks. It raises
   **findings**.
5. **Findings to you** — findings are **proposed to you**, never applied silently.
   The blueprint closes after your confirmation.
6. **Emission of the 3 lifecycle prompts** parametrized (`project-start`,
   `session-start`, `session-end`) into `.cycle/prompts/`.
7. **Instance of `SESSION-STATE.md`** at the root: initial state, no macrotask
   built.

You end up with: `blueprint/`, `.cycle/prompts/`, `SESSION-STATE.md`.

### Phase 2 — `/ciclo:setup` (configure the loop)

Run `/ciclo:setup`. It:

1. **Detects `SOURCE`** — if `blueprint/` with modules exists → `trueline`;
   otherwise → `manual`.
2. **Writes `.cycle/config.sh`** from the template.
3. **Determines the oracles — by actually running them.**
   - `trueline`: helps you set `TEST_CMD`, the project's test command, and
     **runs** it once to confirm it starts. It doesn't invent it.
   - `manual`: inspects `package.json`, `Makefile`, CI workflows, linter configs;
     **runs** each candidate; keeps only those that start, discards the rest. If it
     finds no runnable oracle, it stops and tells you (without oracles the loop
     can't commit-on-green).
4. **Adds `.cycle/logs/` to `.gitignore`.**
5. **Links the driver**: creates `.cycle/ciclo`, a tiny executable wrapper
   pointing at the plugin's driver.
6. **Closes with a `--dry-run` proof**: `./.cycle/ciclo --dry-run` must show the
   queue and exit 0.

### Phase 3 — run the loop (from the terminal)

> ⚠️ **The loop is NOT launched from inside a chat session.** It runs in the
> terminal, because each cycle opens a new session. A session can't restart itself
> from the inside — the external driver does.

From the project root:

```sh
./.cycle/ciclo            # with human gate: asks before each build
./.cycle/ciclo --no-gate  # autonomous: no confirmation, runs on its own
./.cycle/ciclo --dry-run  # dry run: walks the flow WITHOUT calling Claude
./.cycle/ciclo -h         # help
```

For **each macrotask** in the queue:

1. opens a new session (`claude -p --output-format json`) and captures its
   `session_id`;
2. (if the gate is on) asks you to confirm;
3. **builds** the macrotask (`claude -r <sid> -p …`);
4. runs the **oracles**; if they're red it sends Claude the **raw output** — not a
   summary — and retries up to `MAX_FIX_ATTEMPTS`;
5. **commits** (and `git push` if `GIT_PUSH=1`) **only** if the oracles are green;
6. runs the **end-of-session prompt** that updates `SESSION-STATE.md`;
7. ends the process. The next macrotask opens a **fresh session**.

A failed macrotask **does not stop the queue**, but the driver exits **non-zero**
if at least one failed. Every run writes detailed logs to `.cycle/logs/<timestamp>/`.

### Phase 4 — `/ciclo:stato` (inspect)

In chat, `/ciclo:stato` summarizes the last run **from the logs** and — key point —
flags **every divergence** between what `SESSION-STATE.md` claims complete and what
the logs **prove** (green/red oracles, real commits). It fixes nothing: it
observes and reports.

## 5. Worked examples

### Example A — iOS/Swift app with a blueprint (SOURCE=trueline)

```text
# in Claude Code:
/ciclo:blueprint
  → stack: ios-swift; goal and constraints come from you
  → generates blueprint/, .cycle/prompts/, SESSION-STATE.md
/ciclo:setup
  → detects SOURCE=trueline
  → TEST_CMD: iOS doesn't take file paths directly, so we use a wrapper.
```

`.cycle/config.sh` (excerpt) for iOS:

```sh
SOURCE="trueline"
BLUEPRINT_DIR="blueprint"
TEST_CMD="./.cycle/run-tests.sh"   # wrapper: receives files, translates for xcodebuild
ECOSYSTEM="ios-swift"
GATE=1
GIT_PUSH=0
MAX_FIX_ATTEMPTS=3
```

Example wrapper `.cycle/run-tests.sh` (you write it once):

```sh
#!/usr/bin/env bash
# Receives target_tests files as args; maps them to -only-testing for xcodebuild.
set -euo pipefail
args=()
for f in "$@"; do
  # example: map a test file path to a scheme/target; adapt to your project
  args+=( -only-testing "MyAppTests/$(basename "$f" .swift)" )
done
exec xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 15' "${args[@]}"
```

Then, from the terminal:

```sh
./.cycle/ciclo --dry-run     # check the queue
./.cycle/ciclo               # with gate, for the first runs
# once you trust it:
./.cycle/ciclo --no-gate
```

### Example B — any project, hand-written queue (SOURCE=manual)

Useful when there's no blueprint (or you don't want to drive the loop from it).

`.cycle/tasks.txt` (one line = one unit of work):

```text
Login screen with validation
Bookings list with pull-to-refresh
Offline sync
```

`.cycle/config.sh` (excerpt):

```sh
SOURCE="manual"
ORACLES=(
  "npm run lint"
  "npm test"
)
GATE=1
GIT_PUSH=0
MAX_FIX_ATTEMPTS=3
```

The oracles (`ORACLES`) are the same for every line: after building each unit, the
loop runs them all; green only if they all exit 0.

## 6. Reference: `.cycle/config.sh`

It's a bash script the driver "source"s. Fields:

| Field | Source | Meaning |
|---|---|---|
| `SOURCE` | both | `trueline` (queue from blueprint) or `manual` (queue from `tasks.txt`). |
| `BLUEPRINT_DIR` | trueline | The blueprint suite folder (default `blueprint`). |
| `TEST_CMD` | trueline | The project's test command. Receives the macrotask's `target_tests` files as **arguments**. |
| `ORACLES` | manual | Array of shell commands; verdict = exit code. Empty = the loop refuses to start. |
| `SESSION_STATE` | both | Path to the live state (default `SESSION-STATE.md`). |
| `GATE` | both | `1` = human confirmation before each build. `--no-gate` turns it off for that run. |
| `GIT_PUSH` | both | `1` = `git push` after a green commit. |
| `MAX_FIX_ATTEMPTS` | both | Fix attempts (with raw output) before giving up on a macrotask. |
| `ECOSYSTEM` | both | Informational (e.g. `ios-swift`). `ciclo` delegates build/test to the project's skills. |

## 7. Reference: how oracles work

- **Golden rule (D-001)**: an oracle is a command; the verdict is its **exit
  code**. `0` = green (pass), non-zero = red (fail).
- **`SOURCE=trueline`**: for each macrotask, `ciclo` takes its atomic tasks'
  `target_tests` files and passes them to `TEST_CMD` **as arguments**, one oracle
  per file: `TEST_CMD '<file>'`. For runners that accept paths (pytest, jest, go
  test, vitest) this works directly. For stacks that **don't** (e.g. iOS), use a
  wrapper as in Example A.
- **`SOURCE=manual`**: the oracles are the `ORACLES` array, run in order after
  each build; green only if **all** exit 0.
- **Retry with raw output**: if oracles are red, `ciclo` sends Claude the **full
  output** (not a summary) and retries up to `MAX_FIX_ATTEMPTS`. If still red,
  **no commit** and the macrotask is marked failed.

## 8. Reference: a run's logs

Each run creates `.cycle/logs/<timestamp>/`:

```
.cycle/logs/20260824-205127/
├── queue.json                 the computed queue (macrotask, tasks, oracles)
├── oracles.manual.txt         (manual only) the serialized ORACLES array
└── 00-<macrotask-slug>/
    ├── session.json           the --output-format json output (has session_id)
    ├── session.err            stderr from opening the session
    ├── build.log              output of the build turn
    ├── oracles.attempt-0.log  first oracle round (### exit 0/non-zero lines)
    ├── fix-1.log              1st fix attempt (if needed)
    ├── oracles.attempt-1.log  oracles after the 1st fix
    ├── …                      up to MAX_FIX_ATTEMPTS
    └── session-end.log        session close (SESSION-STATE update)
```

`/ciclo:stato` reads exactly these files. Note: `.cycle/logs/` is in `.gitignore`.

## 9. The blueprint format

A module (`blueprint/NN-….md`) holds atomic tasks in ```yaml``` blocks. Minimal
task schema (required fields checked by the structural oracle):

```yaml
- id: T-014                       # unique, stable
  title: "…"
  macrotask: "bookings"           # ownership, non-empty
  depends_on: [T-009, T-011]      # DAG, no cycles, no missing ids
  objective: >
    What it must achieve (prose).
  definition_of_done:             # observable: "the work exists"
    - "…"
  acceptance_criteria:            # testable: "it does the right thing"
    - id: AC-014-1
      given: "…"
      when: "…"
      then: "…"
  target_tests:                   # the criteria made executable
    - file: "tests/bookings.create.test.ts"
      covers: [AC-014-1]
  security_notes:                 # optional
    - "…"
```

The loop's queue (in `trueline`) is the set of **macrotasks** ordered by the
`depends_on` DAG; a macrotask's oracles are its `target_tests`. You can validate a
blueprint by hand:

```sh
node scripts/blueprint/validate_blueprint.mjs blueprint
```

## 10. Ecosystems and build/test delegation

`ciclo` does **not** resolve the ecosystem automatically (no resolver, no
per-ecosystem guide imported). The stack is a declared `ECOSYSTEM` field, and the
*how to test* you declare in `TEST_CMD`/`ORACLES`. The *how to build* comes from
the **ecosystem skills** you install in the project: inside each loop session, the
model uses them to build the macrotask. It's the only piece you write by hand, and
you write it once.

> The file `references/modes/bootstrap.md`, copied verbatim from Trueline, still
> mentions an ecosystem resolver and a `guide.md`: these are two **dangling**
> references in `ciclo`, documented in [`VENDOR.md`](upstream/VENDOR.md). The
> `/ciclo:blueprint` command ignores them and uses the declared `ECOSYSTEM`.

## 11. Design decisions

| ID | Decision |
|---|---|
| **D-001** | An oracle is a command: exit `0` = pass. No worded verdict counts as verification. |
| **D-002** | The loop runs **outside** the session: `claude -p` per macrotask. No `/clear`: it's removed, not automated. |
| **D-003** | Continuity between cycles flows through `SESSION-STATE.md`, never through context. |
| **D-004** | Files taken from Trueline are **copied verbatim** and tracked in `VENDOR.md` with the origin commit SHA. |
| **D-005** | Two sources for the loop: `trueline` (from the blueprint) and `manual` (from config). Same driver, two adapters. |
| **D-006** | Zero runtime dependencies beyond Node (built-in), `git`, `jq`. No `npm install`. |

## 12. FAQ and troubleshooting

**The loop won't start and prints a "GATE ZERO failed".**
The blueprint fails the structural self-check. The report says which check fell
(e.g. `T-010: missing acceptance_criteria`). Fix the blueprint and retry. The loop
**won't start** until the plan is valid — by design.

**"missing .cycle/config.sh — run /ciclo:setup".**
You haven't configured the loop on this project yet. Run `/ciclo:setup`.

**"GATE on but no /dev/tty".**
You're running the loop in a context without an interactive terminal while the
gate is on. Use `--no-gate` for autonomous execution.

**"no oracle: ORACLES array empty".**
In `manual`, `ORACLES` is empty. Without oracles there's no verification, so no
commit-on-green: add at least one proven command (`/ciclo:setup` discovers and
runs them for you).

**A green oracle but "git commit produced nothing".**
The build changed no files (clean working tree). Not a loop error: there was
nothing to commit.

**My test runner doesn't accept file paths (e.g. iOS).**
Use a wrapper as `TEST_CMD` (Example A) that translates files into your runner's
arguments. `/ciclo:setup` runs the command before writing it, so a broken
`TEST_CMD` shows up immediately.

**I want automatic push.**
Set `GIT_PUSH=1` in `.cycle/config.sh`. Push happens only after a green commit.

**How do I re-run the plugin's script tests?**
`node --test scripts/blueprint/*.test.mjs`.

**(Advanced) Test the driver without calling the API.**
The driver honors `CICLO_CLAUDE_BIN` to override the `claude` binary (handy for
end-to-end tests with a stub). Default: `claude`.

## 13. Glossary

- **Blueprint** — the technical plan: macrotasks + verifiable atomic tasks.
- **Macrotask** — the unit of the loop's queue and of the atomic commit.
- **Atomic task** — the smallest unit of the plan, with DoD + AC + target_tests.
- **Oracle** — a command that decides pass/fail via exit code (D-001).
- **Gate zero** — the structural self-check that must be green before the loop starts.
- **Human gate** — the confirmation before each build (`GATE=1`, `--no-gate` removes it).
- **SESSION-STATE.md** — the project's live state, the source of continuity (D-003).
