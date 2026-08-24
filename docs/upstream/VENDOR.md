# VENDOR.md — file importati da Trueline

Questo plugin **copia verbatim** una parte del runtime di BOOTSTRAP dal repo
Trueline (decisione **D-004**: i file si copiano, non si riscrivono né si
"migliorano"). Questo manifest esiste perché la risincronizzazione futura sia
possibile: senza, il plugin diventa un fork orfano nel giro di due mesi.

Regola: **nessun file copiato deve mancare da questa tabella**, e nessuna riga
qui deve puntare a un file assente (criterio di accettazione §9.9).

## Origine

| Campo | Valore |
|---|---|
| Repo | `https://github.com/claudiosnivel-dot/Trueline-Skill` |
| Branch | `main` |
| Commit SHA | `5442a50c9d8ecc6c162ee05727d7e6b8fd8f91dc` |
| Data del clone | 2026-08-24 |

## File importati (verbatim)

Percorsi di destinazione relativi alla root del plugin `ciclo/`; percorsi
d'origine relativi alla root del clone di Trueline-Skill.

| Destinazione in `ciclo/` | Origine in Trueline-Skill |
|---|---|
| `references/modes/bootstrap.md` | `trueline/references/modes/bootstrap.md` |
| `references/blueprint/atomic-task-schema.md` | `trueline/references/blueprint/atomic-task-schema.md` |
| `references/blueprint/self-check-checklist.md` | `trueline/references/blueprint/self-check-checklist.md` |
| `references/blueprint/template/00-INDEX.template.md` | `trueline/references/blueprint/template/00-INDEX.template.md` |
| `references/blueprint/template/01-example-macrotask.template.md` | `trueline/references/blueprint/template/01-example-macrotask.template.md` |
| `references/blueprint/template/SESSION-STATE.template.md` | `trueline/references/blueprint/template/SESSION-STATE.template.md` |
| `references/blueprint/template/VISION-AND-CONSTRAINTS.template.md` | `trueline/references/blueprint/template/VISION-AND-CONSTRAINTS.template.md` |
| `references/blueprint/template/blueprint-module.template.md` | `trueline/references/blueprint/template/blueprint-module.template.md` |
| `references/blueprint/template/task.template.yaml` | `trueline/references/blueprint/template/task.template.yaml` |
| `references/conventions/named-standards.md` | `trueline/references/conventions/named-standards.md` |
| `references/conventions/threat-model.md` | `trueline/references/conventions/threat-model.md` |
| `assets/prompts/project-start.md` | `trueline/assets/prompts/project-start.md` |
| `assets/prompts/session-start.md` | `trueline/assets/prompts/session-start.md` |
| `assets/prompts/session-end.md` | `trueline/assets/prompts/session-end.md` |
| `scripts/blueprint/validate_blueprint.mjs` | `trueline/scripts/blueprint/validate_blueprint.mjs` |
| `scripts/blueprint/arch_contract.mjs` | `trueline/scripts/blueprint/arch_contract.mjs` |
| `scripts/blueprint/blueprint_tasks.mjs` | `trueline/scripts/blueprint/blueprint_tasks.mjs` |
| `scripts/blueprint/arch_contract.test.mjs` | `trueline/scripts/blueprint/arch_contract.test.mjs` |
| `scripts/blueprint/blueprint_tasks.test.mjs` | `trueline/scripts/blueprint/blueprint_tasks.test.mjs` |
| `scripts/blueprint/validate_blueprint.arch.test.mjs` | `trueline/scripts/blueprint/validate_blueprint.arch.test.mjs` |
| `docs/upstream/11-BLUEPRINT-ENGINE.md` | `11-BLUEPRINT-ENGINE.md` (root del repo) |
| `docs/upstream/12-LIFECYCLE-PROMPTS.md` | `12-LIFECYCLE-PROMPTS.md` (root del repo) |

### Perché `arch_contract.mjs` e `blueprint_tasks.mjs`

`bootstrap.md` elenca come "script usato" solo `validate_blueprint.mjs`. I due in
più sono dipendenze reali, non aggiunte arbitrarie:

- **`arch_contract.mjs`** è importato direttamente da `validate_blueprint.mjs`
  (`import { loadArchContract, validateArchContract } from './arch_contract.mjs'`).
  Senza, il validatore non gira.
- **`blueprint_tasks.mjs`** esporta `loadTasks(dir)` e serve all'adapter
  `bin/ciclo-queue.mjs` per costruire la coda dei macrotask dal blueprint.

Entrambi importano **solo** built-in di Node (`node:fs`, `node:path`) più, nel
caso di `validate_blueprint.mjs`, il fratello `arch_contract.mjs`. Nessun import
verso la metà "security review" esclusa (§9.10 verificato).

## Deviazioni intenzionali dal comportamento originale di Trueline

`bootstrap.md` è copiato **verbatim** e quindi contiene ancora due riferimenti a
componenti che **non** sono stati importati, per scelta (l'ecosistema non serve a
`ciclo`, che delega build/test alle skill di ecosistema installate nel progetto):

- `scripts/ecosystem/resolve.mjs` — il resolver automatico di ecosistema.
- `references/ecosystems/<eco>/guide.md` — le guide per-ecosistema.

In `ciclo` l'ecosistema **non viene risolto automaticamente**: il comando
`/ciclo:blueprint` usa un campo `ECOSYSTEM` dichiarato (o nessuno). Vedi il README,
sezione "Ecosistema", e `commands/blueprint.md`.

## Come rifare la vendorizzazione (risync)

Da una directory temporanea **fuori** dal repo del plugin:

```sh
# 1. clona la revisione desiderata
git clone https://github.com/claudiosnivel-dot/Trueline-Skill.git trueline-src
cd trueline-src
# (per riprodurre esattamente questa importazione: git checkout 5442a50c9d8ecc6c162ee05727d7e6b8fd8f91dc)
SRC="$PWD/trueline"; ROOT="$PWD"; DST=/percorso/al/plugin/ciclo

# 2. references
cp "$SRC/references/modes/bootstrap.md"                "$DST/references/modes/bootstrap.md"
cp "$SRC/references/blueprint/atomic-task-schema.md"   "$DST/references/blueprint/atomic-task-schema.md"
cp "$SRC/references/blueprint/self-check-checklist.md" "$DST/references/blueprint/self-check-checklist.md"
cp -R "$SRC/references/blueprint/template"             "$DST/references/blueprint/template"
cp "$SRC/references/conventions/named-standards.md"    "$DST/references/conventions/named-standards.md"
cp "$SRC/references/conventions/threat-model.md"       "$DST/references/conventions/threat-model.md"

# 3. assets/prompts
cp "$SRC/assets/prompts/project-start.md" "$DST/assets/prompts/project-start.md"
cp "$SRC/assets/prompts/session-start.md" "$DST/assets/prompts/session-start.md"
cp "$SRC/assets/prompts/session-end.md"   "$DST/assets/prompts/session-end.md"

# 4. scripts/blueprint (core + test corrispondenti)
cp "$SRC/scripts/blueprint/validate_blueprint.mjs"          "$DST/scripts/blueprint/validate_blueprint.mjs"
cp "$SRC/scripts/blueprint/arch_contract.mjs"               "$DST/scripts/blueprint/arch_contract.mjs"
cp "$SRC/scripts/blueprint/blueprint_tasks.mjs"             "$DST/scripts/blueprint/blueprint_tasks.mjs"
cp "$SRC/scripts/blueprint/arch_contract.test.mjs"          "$DST/scripts/blueprint/arch_contract.test.mjs"
cp "$SRC/scripts/blueprint/blueprint_tasks.test.mjs"        "$DST/scripts/blueprint/blueprint_tasks.test.mjs"
cp "$SRC/scripts/blueprint/validate_blueprint.arch.test.mjs" "$DST/scripts/blueprint/validate_blueprint.arch.test.mjs"

# 5. docs/upstream (specifica di riferimento)
cp "$ROOT/11-BLUEPRINT-ENGINE.md"  "$DST/docs/upstream/11-BLUEPRINT-ENGINE.md"
cp "$ROOT/12-LIFECYCLE-PROMPTS.md" "$DST/docs/upstream/12-LIFECYCLE-PROMPTS.md"

# 6. verifica: i test copiati devono passare
node --test "$DST"/scripts/blueprint/*.test.mjs
```

Dopo un risync, **aggiorna il commit SHA in questo file** e ri-esegui i test.
