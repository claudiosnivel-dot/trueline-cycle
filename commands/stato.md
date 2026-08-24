---
description: Riassume l'esito dell'ultimo run del loop dai log e segnala ogni divergenza fra SESSION-STATE.md e ciò che i log dimostrano.
---

# /ciclo:stato — esito dell'ultimo run

Riassumi l'ultimo run del loop **dai log** e confrontalo con `SESSION-STATE.md`.
Il principio è quello di tutto `ciclo`: conta ciò che i log **dimostrano** (exit
code, commit reali), non ciò che qualcuno dichiara a parole.

## 1. Trova l'ultimo run

Il run più recente è la cartella con timestamp più alto sotto `.cycle/logs/`:

```sh
ls -dt .cycle/logs/*/ | head -1
```

Se non ce n'è nessuno, dillo: il loop non è mai partito.

## 2. Ricostruisci l'esito dai log

Nel run trovi:

- `queue.json` — la coda: `.queue[].macrotask`, `.tasks`, `.oracles`. Se
  `.ok == false`, il loop non è partito: riporta `gate`/`report` o `error` e
  fermati qui (non c'è nulla da confrontare).
- una cartella per macrotask `NN-<slug>/` con:
  - `session.json` — il `session_id` della sessione aperta,
  - `oracles.attempt-*.log` — ogni tentativo di oracoli, con le righe
    `### exit 0 (verde)` / `### exit non-zero (rosso)`,
  - `fix-*.log` — i tentativi di correzione (se ci sono stati),
  - `session-end.log` — la chiusura di sessione.

Per ogni macrotask determina l'**esito reale**:

- **verde** se l'ultimo `oracles.attempt-*.log` non contiene righe rosse;
- **rosso** altrimenti (e quanti tentativi di fix sono stati spesi).

Poi verifica il **commit**: un macrotask verde dovrebbe avere un commit
`ciclo: macrotask <nome>` in `git log`. Controllalo:

```sh
git log --oneline | grep -F "ciclo: macrotask"
```

## 3. Confronta con `SESSION-STATE.md` e segnala OGNI divergenza

Leggi `SESSION-STATE.md` e per ogni macrotask che dichiara **completato**,
verifica che i log lo confermino. Segnala esplicitamente ogni divergenza, per es.:

- `SESSION-STATE` dice **completato** ma i log mostrano oracoli **rossi** o nessun
  tentativo verde → **divergenza**.
- `SESSION-STATE` dice **completato** ma **non** esiste il commit corrispondente in
  `git log` → **divergenza**.
- Un macrotask **verde** nei log e con commit, ma **assente/non aggiornato** in
  `SESSION-STATE` → **divergenza** (stato vivo non aggiornato).

## 4. Riepiloga

Presenta all'utente:

1. run analizzato (timestamp), `SOURCE`, numero di macrotask;
2. tabella per macrotask: esito reale (verde/rosso), tentativi di fix, commit sì/no;
3. **l'elenco delle divergenze** SESSION-STATE ↔ log (o "nessuna divergenza");
4. l'exit code complessivo che il driver avrebbe restituito (0 se tutti verdi,
   non-zero se almeno uno rosso).

Non correggere nulla e non aggiornare `SESSION-STATE` da solo: `/ciclo:stato`
**osserva e segnala**, non rimedia.
