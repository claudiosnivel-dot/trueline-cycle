---
description: Genera un blueprint tecnico (BOOTSTRAP) — brainstorming, task atomici verificabili, self-check strutturale deterministico e semantico guidato.
---

# /ciclo:blueprint — BOOTSTRAP

Esegui la pipeline di pianificazione **BOOTSTRAP** estratta da Trueline: dal nulla
al **piano**, nessun codice prodotto. Il piano è il blueprint.

## Riferimenti da caricare (dentro questo plugin)

Sono file vendorizzati da Trueline (vedi `docs/upstream/VENDOR.md`). Il loro
percorso base è la root del plugin `ciclo`, cioè `${CLAUDE_PLUGIN_ROOT}`.

- **Pipeline autorevole**: `${CLAUDE_PLUGIN_ROOT}/references/modes/bootstrap.md` — **leggila e seguila**.
- Schema obbligatorio dei task: `${CLAUDE_PLUGIN_ROOT}/references/blueprint/atomic-task-schema.md`
- Checklist semantica (punti 6–10): `${CLAUDE_PLUGIN_ROOT}/references/blueprint/self-check-checklist.md`
- Template della suite: `${CLAUDE_PLUGIN_ROOT}/references/blueprint/template/`
- Vocabolario sicurezza per le `security_notes`: `${CLAUDE_PLUGIN_ROOT}/references/conventions/named-standards.md`
- Procedura threat model (forma ridotta, §6.2): `${CLAUDE_PLUGIN_ROOT}/references/conventions/threat-model.md`
- Prompt di lifecycle da emettere: `${CLAUDE_PLUGIN_ROOT}/assets/prompts/`

Leggi `bootstrap.md` per intero **prima** di generare qualsiasi cosa. Dove diverge
da questo comando, `bootstrap.md` è la fonte; questo file ne è solo il driver
operativo dentro `ciclo`.

## Differenza rispetto a Trueline: l'ecosistema

`ciclo` **non risolve l'ecosistema automaticamente** (niente `resolve.mjs`, niente
`references/ecosystems/`). `bootstrap.md`, copiato verbatim, cita ancora quel
resolver e una `guide.md` per-ecosistema: **ignora quei due riferimenti**. Al loro
posto:

- Chiedi all'utente lo stack di destinazione e trattalo come campo **`ECOSYSTEM`
  dichiarato** (es. `ios-swift`, `android-kotlin`, `postgres-jsts`, …). Non
  inventarlo, non dedurlo di nascosto.
- Le conoscenze specifiche di build/test dello stack **non** appartengono a
  `ciclo`: le fornisce l'utente con le proprie skill di ecosistema installate nel
  progetto. Qui `ECOSYSTEM` serve solo a orientare la prosa del blueprint e a
  parametrizzare i prompt di lifecycle.
- Se lo stack non ha convenzioni note, procedi comunque: il blueprint resta
  valido, e gli oracoli concreti verranno dichiarati in fase di `/ciclo:setup`.

## Dove scrivere gli artefatti

Convenzione di `ciclo` (usata poi da `/ciclo:setup` e dal loop):

- La **suite di blueprint** va in `blueprint/` alla root del progetto:
  `blueprint/00-INDEX.md`, `blueprint/VISION-AND-CONSTRAINTS.md`, e i moduli
  numerati `blueprint/01-….md`, `blueprint/02-….md`, … Ogni modulo contiene i
  suoi task atomici in blocchi ```yaml``` secondo lo schema.
- `SESSION-STATE.md` va alla **root del progetto** (è lo stato vivo, letto a ogni
  sessione del loop).

## Pipeline (segui `bootstrap.md`)

1. **Raccolta intento / brainstorming.** Obiettivo del progetto, `ECOSYSTEM`,
   vincoli noti (performance, privacy, timeline, integrazioni). **Input
   dell'utente, mai invenzione dell'LLM**: se un vincolo non è dichiarato, non lo
   inventi. Questa è la fase di brainstorming che fai *insieme* all'utente.
2. **Generazione blueprint** dai template. Ogni task atomico porta
   **obbligatoriamente** `definition_of_done`, `acceptance_criteria`,
   `target_tests` (schema in `atomic-task-schema.md`).
3. **Self-check strutturale (oracolo).** Esegui:
   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/blueprint/validate_blueprint.mjs" blueprint
   ```
   Deve uscire **exit 0**. Se esce ≠ 0 il blueprint è **rifiutato**: correggi e
   ri-esegui. **Non** passare al self-check semantico finché non è verde (§5.3).
4. **Self-check semantico (checklist guidata).** Applica i punti 6–10 di
   `self-check-checklist.md` a ogni task. Ogni punto ha esito esplicito `OK` o
   `RILIEVO: <cosa correggere>`. Non marcare `OK` "a sensazione".
5. **Threat model per le `security_notes`.** Per i task che toccano dati/auth,
   applica `threat-model.md §6.2` in forma ridotta e cita RLS/segreti **per nome**
   (mai "gestione sicura" generico). Il threat model produce *scope*, non verdetti.
6. **Rilievi all'utente (human-in-the-loop).** I rilievi del passo 4 si
   **propongono all'utente** e non si applicano in silenzio. Il blueprint si
   chiude solo dopo la conferma.
7. **Emissione dei 3 prompt di lifecycle.** Parametrizza i template di
   `assets/prompts/` (`project-start.md`, `session-start.md`, `session-end.md`)
   riempiendo i placeholder `{{…}}` con gli input dell'utente e il blueprint —
   **niente placeholder residuo**. Scrivili in `.cycle/prompts/` alla root del
   progetto (il loop li userà da lì).
8. **Istanzia `SESSION-STATE.md`** alla root del progetto dal template: blueprint
   pronto, nessun macrotask costruito, baseline vuota,
   `main_deploy_coupled: unknown`.

## Chiusura

Quando il blueprint è chiuso (strutturale verde + rilievi risolti + conferma),
di' all'utente che il passo successivo è `/ciclo:setup` per configurare il loop,
e che il ciclo continuo si lancia **dal terminale** (non da dentro una sessione).

## Disciplina (non negoziabile)

- **Oracle-as-judge per il piano**: l'unico oracolo di questa fase è
  `validate_blueprint.mjs`. La qualità semantica non è un verdetto dell'LLM: è una
  checklist vincolata che *solleva rilievi*.
- Anche con la checklist tutta-OK l'esito è "il piano ha superato i controlli e
  non presenta rilievi", **non** "il piano è giusto": la correttezza dell'intento
  resta una scelta umana.
