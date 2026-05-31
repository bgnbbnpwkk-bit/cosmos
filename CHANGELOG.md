# Changelog

Alle nennenswerten Änderungen an COSMOS werden hier dokumentiert.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

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
