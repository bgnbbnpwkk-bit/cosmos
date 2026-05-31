# COSMOS – KI-Proxy (Cloudflare Worker)

Die COSMOS-App ist statisch (GitHub Pages) und kann die Anthropic-API nicht
direkt aufrufen (der API-Key darf nicht in den Browser, außerdem blockt CORS).
Dieser kleine Worker sitzt dazwischen: Die App ruft den Worker auf, der Worker
hängt den geheimen Key an und leitet an Anthropic weiter.

```
Browser (App)  ──►  Cloudflare Worker (mit Secret)  ──►  api.anthropic.com
```

---

## Schritt 1 – Anthropic API-Key erstellen

1. Gehe auf **https://console.anthropic.com** und melde dich an (bzw. registriere dich).
2. Lege unter **Billing / Plans** etwas Guthaben an oder hinterlege eine Zahlungsmethode.
   Die Nutzung wird pro Anfrage abgerechnet; für Tests reichen wenige Euro lange.
   Tipp: Setze unter **Limits** ein monatliches Ausgaben-Limit (z. B. 5 €) als Schutz.
3. Öffne **API Keys** → **Create Key**, gib ihm einen Namen (z. B. `cosmos`).
4. **Kopiere den Key sofort** (`sk-ant-...`) – er wird nur einmal angezeigt.
   Bewahre ihn sicher auf und teile ihn mit niemandem.

> Der Key kommt **nicht** in den App-Code und **nicht** ins Git-Repo,
> sondern nur als Cloudflare-Secret (Schritt 4).

## Schritt 2 – Cloudflare-Account & Wrangler

1. Kostenlosen Account anlegen: **https://dash.cloudflare.com/sign-up**
2. Node.js installiert? Dann brauchst du nichts global zu installieren –
   `npx` lädt Wrangler bei Bedarf.

## Schritt 3 – Worker konfigurieren

In diesem Ordner liegen `worker.js` und `wrangler.toml`.
Prüfe in `wrangler.toml`, dass `ALLOWED_ORIGIN` deiner GitHub-Pages-Adresse
entspricht (Standard: `https://bgnbbnpwkk-bit.github.io`). Nur von dieser
Origin akzeptiert der Worker Anfragen.

## Schritt 4 – Deployen

Im Ordner `worker/` ausführen:

```bash
# Einmalig: bei Cloudflare anmelden (öffnet den Browser)
npx wrangler login

# Den API-Key als Secret hinterlegen (wird verschlüsselt gespeichert)
npx wrangler secret put ANTHROPIC_API_KEY
# -> hier den sk-ant-... Key einfügen und Enter

# Worker veröffentlichen
npx wrangler deploy
```

Nach dem Deploy zeigt Wrangler die URL an, z. B.:

```
https://cosmos-proxy.DEIN-SUBDOMAIN.workers.dev
```

**Diese URL kopieren** – sie wird im nächsten Schritt gebraucht.

## Schritt 5 – App mit dem Proxy verbinden

In `src/App.jsx` die Konstante `PROXY_URL` auf deine Worker-URL setzen:

```js
const PROXY_URL = import.meta.env.VITE_PROXY_URL || "https://cosmos-proxy.DEIN-SUBDOMAIN.workers.dev";
```

Alternativ ohne Code-Änderung über eine Datei `.env` im Projekt-Root:

```
VITE_PROXY_URL=https://cosmos-proxy.DEIN-SUBDOMAIN.workers.dev
```

Dann neu bauen und deployen (im Projekt-Root):

```bash
npm run deploy
```

## Schritt 6 – Testen

App öffnen → Tab **Chat** → eine Frage stellen. Kommt eine Antwort, läuft alles.
Bei Fehlern zeigt die App eine ⚠️-Meldung; prüfe dann:

- Ist `PROXY_URL` korrekt (exakte Worker-URL, ohne Tippfehler)?
- Wurde das Secret `ANTHROPIC_API_KEY` gesetzt? (`npx wrangler secret list`)
- Stimmt `ALLOWED_ORIGIN` mit der aufrufenden Seite überein?
- Hat dein Anthropic-Account Guthaben?

---

## Kosten & Sicherheit

- Abrechnung erfolgt pro Token bei Anthropic. `max_tokens` ist im Worker auf
  2000 gedeckelt (`MAX_TOKENS_CAP`), um Ausreißer zu vermeiden.
- `ALLOWED_ORIGIN` verhindert, dass Fremde deinen Proxy (und damit dein
  Guthaben) von anderen Seiten aus nutzen. Hinweis: Das ist ein Basisschutz –
  für hohe Sicherheit ließe sich zusätzlich Rate-Limiting oder ein Token
  ergänzen.
- Der API-Key liegt ausschließlich als Cloudflare-Secret vor, nie im Browser
  oder im Git-Repo.
