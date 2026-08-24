---
description: Configura il loop di build sul progetto corrente — rileva SOURCE, scrive .cycle/, collega il driver, chiude con una prova --dry-run.
---

# /ciclo:setup — configura il loop

Configura `ciclo` sul progetto corrente. Base dei file del plugin:
`${CLAUDE_PLUGIN_ROOT}`. Template da copiare: `${CLAUDE_PLUGIN_ROOT}/templates/`.

Regola d'oro (§8, §10): **non inventare comandi**. Un comando di verifica entra
nella config **solo** dopo che l'hai *eseguito* e ha dimostrato di partire. Se non
trovi prova che un comando esista, non scriverlo.

## 1. Rileva `SOURCE`

- Se esiste una suite di blueprint (dir `blueprint/` con moduli `NN-….md` che
  contengono task in blocchi ```yaml```) → **`SOURCE=trueline`**.
- Altrimenti → **`SOURCE=manual`**.

Dillo all'utente e procedi con il ramo giusto.

## 2. Scrivi `.cycle/config.sh`

Copia `${CLAUDE_PLUGIN_ROOT}/templates/config.sh` in `.cycle/config.sh` e riempilo.

### Ramo `trueline`

1. `SOURCE="trueline"`, `BLUEPRINT_DIR` alla dir del blueprint.
2. Determina `TEST_CMD` — il comando di test del progetto. Non dedurlo dal nulla:
   ispeziona il progetto (script in `package.json`, `Makefile`, workflow CI,
   config del runner) **e chiedi conferma all'utente** su quale sia il comando di
   test. `ciclo` gli passerà i file `target_tests` del macrotask come argomenti,
   quindi `TEST_CMD` deve accettare path di file (per stack che non lo fanno, es.
   iOS, concorda con l'utente uno script wrapper).
3. **Esegui `TEST_CMD`** una volta (anche a vuoto/`--help` se serve) per verificare
   che parta. Se non parte, non lasciarlo in config: risolvi con l'utente.

### Ramo `manual`

1. `SOURCE="manual"`.
2. **Coda** — crea `.cycle/tasks.txt` (parti da
   `${CLAUDE_PLUGIN_ROOT}/templates/tasks.txt`). Se c'è un blueprint ma l'utente
   vuole comunque manuale, puoi derivarne le righe; altrimenti le fornisce l'utente.
   Non inventare unità di lavoro.
3. **Oracoli** — scopri i comandi di verifica che **esistono davvero**:
   - script in `package.json` (`test`, `lint`, `typecheck`, `build`, …),
   - target di `Makefile`,
   - passi dei workflow CI (`.github/workflows/*.yml`),
   - config dei linter (eslint, ruff, swiftlint, …).
   Per **ciascun candidato**: **eseguilo**. Se parte e ha un exit code sensato,
   entra nell'array `ORACLES`. Se non parte (comando assente, dipendenze mancanti),
   **scartalo senza discutere** e dillo all'utente. L'array finale contiene solo
   comandi provati.
   - Se non trovi **nessun** oracolo eseguibile, fermati e dillo all'utente: senza
     oracoli il loop non può committare condizionato al verde (D-001). Non
     inventarne uno.

## 3. `.gitignore`

Aggiungi `.cycle/logs/` a `.gitignore` del progetto (i log per-run non si
committano). Non toccare il resto del file.

## 4. Collega il driver

Scrivi un piccolo wrapper `.cycle/ciclo` che punta al driver del plugin, così
l'utente lo lancia dalla root del progetto:

```sh
printf '#!/usr/bin/env bash\nexec "%s/bin/ciclo" "$@"\n' "${CLAUDE_PLUGIN_ROOT}" > .cycle/ciclo
chmod +x .cycle/ciclo
```

(Il ciclo continuo si lancia **dal terminale**, non da dentro una sessione: D-002.)

## 5. Prova `--dry-run`

Chiudi eseguendo:

```sh
./.cycle/ciclo --dry-run
```

Deve percorrere l'intero flusso senza chiamare Claude e mostrare la coda. Se
stampa la coda ed esce 0, la configurazione è valida. Riporta l'esito all'utente e
spiega come avviare il loop vero:

- con gate umano:  `./.cycle/ciclo`
- in autonomia:    `./.cycle/ciclo --no-gate`  (aggiungi `GIT_PUSH=1` in config per il push)
