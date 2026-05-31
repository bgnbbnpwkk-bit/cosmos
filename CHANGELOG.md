# Changelog

Alle nennenswerten Änderungen an COSMOS werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [1.2.0] – 2026-05-31

### Geändert
- KI-Backend von Anthropic Claude auf **Google Gemini** (`gemini-2.0-flash`)
  umgestellt – Aufruf direkt aus dem Browser (Gemini erlaubt CORS).
- API-Key wird über das ⓘ-Menü eingegeben und **nur lokal im Browser**
  (`localStorage`) gespeichert – nie im Code, Repo oder Bundle.
- ⓘ-Modal um ein Schlüssel-Eingabefeld (Speichern/Entfernen, Status) erweitert;
  Tech-Stack & Version aktualisiert.

### Entfernt
- Cloudflare-Worker-Proxy (`worker/`) – mit der lokalen Key-Lösung nicht mehr
  nötig.

### Hinweise
- Empfehlung: Im Google-Cloud-Console eine HTTP-Referrer-Beschränkung auf die
  Pages-Adresse setzen und den Key auf dem Free-Tier (ohne Billing) belassen.

## [1.1.0] – 2026-05-31

### Hinzugefügt
- Cloudflare-Worker-Proxy (`worker/`), der den Anthropic-API-Key serverseitig
  hält und Anfragen weiterleitet – inkl. CORS-Handling, Origin-Whitelist und
  `max_tokens`-Deckelung als Kostenschutz.
- Ausführliche Einrichtungsanleitung (`worker/README.md`), inkl. Erstellen des
  Anthropic-API-Keys, Deploy via Wrangler und Verbindung mit der App.

### Geändert
- Frontend ruft nun den Proxy (`PROXY_URL` / `VITE_PROXY_URL`) statt direkt die
  Anthropic-API auf.
- `callClaude` mit Fehlerbehandlung versehen: verständliche ⚠️-Meldungen statt
  stiller Abbrüche bei Fehlkonfiguration.

### Behoben
- Die KI-Funktionen (Infos, Quiz, Chat) sind damit grundsätzlich
  funktionsfähig, sobald der Proxy deployed und `PROXY_URL` gesetzt ist.

## [1.0.0] – 2026-05-31

### Hinzugefügt
- Erste Version der COSMOS-PWA (React + Vite), deploybar auf GitHub Pages.
- Drei Tabs: **Infos** (KI-Überblick zu 6 Astronomie-Themen), **Quiz**
  (Multiple-Choice & Freitext mit KI-Bewertung) und **Chat** (freier Dialog
  mit einem Astrophysik-Experten).
- Animierter Sternenhimmel-Hintergrund und Kosmos-Farbverlauf.
- PWA-Manifest mit Standalone-Anzeige und Theme-Farbe.
- Eigenes App-Icon (Sparkle ✦ im Marken-Verlauf Lila → Indigo → Sky auf
  dunklem Kosmos-Hintergrund) als SVG sowie gerasterte PNGs.
- `apple-touch-icon` und `apple-mobile-web-app`-Meta-Tags für korrekte
  Darstellung beim „Zum Home-Bildschirm hinzufügen" auf iOS.

### Geändert
- Manifest-Icons von externem Twemoji-PNG auf lokale 192/512-PNGs
  (inkl. `maskable`) umgestellt.

### Behoben
- iOS-Overscroll/Rubber-Band unterbunden: Dokument wird fixiert, nur der
  Inhalt (`#root`) scrollt — der App-Screen lässt sich nicht mehr verschieben.

### Bekannte Einschränkungen
- Die KI-Funktionen (Infos, Quiz, Chat) rufen die Anthropic-API direkt aus
  dem Browser auf und funktionieren in der gehosteten Version noch nicht
  (fehlende serverseitige Authentifizierung + CORS). Ein Proxy-/Serverless-
  Endpunkt ist als nächster Schritt geplant.
