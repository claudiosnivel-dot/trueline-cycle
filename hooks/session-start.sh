#!/usr/bin/env bash
# session-start.sh — hook SessionStart del plugin ciclo.
#
# Inietta un contesto minimo nelle sessioni INTERATTIVE di un progetto ciclo, così
# l'agente sa che deve leggere SESSION-STATE.md e come si lancia il loop.
#
# NON inietta quando la sessione è aperta dal driver del loop (CICLO_DRIVER=1):
# in quel caso il contesto è già nel prompt passato dal driver (§6).
#
# Copre le fonti SessionStart startup|clear|compact|resume (vedi hooks.json).
# Solo built-in di shell: deve essere istantaneo, niente I/O pesante.

set -euo pipefail

# Salta se la sessione la apre il driver.
[ "${CICLO_DRIVER:-0}" = "1" ] && exit 0

PROJ="${CLAUDE_PROJECT_DIR:-$PWD}"

# Inietta solo se questo è davvero un progetto ciclo.
if [ -f "$PROJ/.cycle/config.sh" ] || [ -f "$PROJ/SESSION-STATE.md" ] || [ -d "$PROJ/blueprint" ]; then
  cat <<'EOF'
Questo progetto usa il plugin `ciclo`. Prima di agire: leggi SESSION-STATE.md (lo
stato vivo del progetto) e, se presente, la suite in blueprint/ (il piano di
macrotask). Comandi disponibili: /ciclo:blueprint (pianifica), /ciclo:setup
(configura il loop), /ciclo:stato (esito dell'ultimo run). Il ciclo di build
continuo NON si lancia da qui: gira nel terminale con il comando `ciclo`, che apre
una sessione nuova per ogni macrotask.
EOF
fi

exit 0
