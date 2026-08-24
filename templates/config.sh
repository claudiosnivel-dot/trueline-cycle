# .cycle/config.sh — configurazione del loop ciclo.
# Generato da /ciclo:setup. È uno script bash: viene "source"-ato dal driver.

# Sorgente di coda e oracoli (D-005):
#   trueline → coda e oracoli derivati dal blueprint (dir blueprint/ presente)
#   manual   → coda da .cycle/tasks.txt, oracoli dall'array ORACLES qui sotto
SOURCE="manual"

# ── SOURCE=trueline ───────────────────────────────────────────────────────────
BLUEPRINT_DIR="blueprint"     # dir della suite di blueprint (relativa alla root)
# Comando di test del progetto. ciclo NON conosce lo stack: lo esegue e gli passa
# i file target_tests del macrotask come argomenti. Deve accettare path di file e
# uscire 0/non-0 (D-001). Es.: "npx vitest run", "pytest", "go test ./...".
# Per stack che non prendono file (es. iOS), usa uno script wrapper che li accetti.
TEST_CMD=""

# ── SOURCE=manual ─────────────────────────────────────────────────────────────
# Coda in .cycle/tasks.txt (una riga = un'unità di lavoro; vuote e # ignorate).
# Oracoli: array di comandi shell; verdetto = exit code (D-001). Ogni comando qui
# è stato ESEGUITO da /ciclo:setup e ha dimostrato di partire. Array vuoto = il
# loop si rifiuta di partire (niente verifica = niente commit condizionato).
ORACLES=(
  # "npm run lint"
  # "npm test"
)

# ── comune ────────────────────────────────────────────────────────────────────
SESSION_STATE="SESSION-STATE.md"  # stato vivo, letto/aggiornato a ogni sessione
GATE=1               # 1 = conferma umana prima di ogni build (--no-gate spegne)
GIT_PUSH=0           # 1 = git push dopo il commit verde
MAX_FIX_ATTEMPTS=3   # tentativi di fix (con output grezzo) prima di arrendersi
ECOSYSTEM=""         # informativo (es. ios-swift). ciclo delega build/test alle
                     # skill di ecosistema installate nel progetto.
