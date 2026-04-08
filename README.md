# MBRN Finanz-Rechner 💸

[![Live Demo](https://img.shields.io/badge/Live-Demo-green)](https://mbrn-flase.github.io/FinanzRechner/)
[![Tests](https://img.shields.io/badge/Tests-Vitest+Playwright-blue)](./package.json)

> **Was wärst du heute wert — wenn du früher angefangen hättest?**

Zinseszins-Rechner mit Echtzeit-Kursen, vier Anlagemodellen, Inflationsberechnung und steuerbereinigten Ergebnissen.

## ✨ Features

- 📈 **Vier Anlagemodelle**: S&P 500, World ETF, Bitcoin, Sparkonto
- 💱 **Live-Kurse**: BTC & ETH via CoinGecko API
- 📊 **Inflationsberechnung**: Individuell konfigurierbar (2-5% oder Custom)
- 💰 **Steuerberechnung**: Abgeltungssteuer mit Teilfreistellung (ETF) / Haltefrist-Logik (Crypto)
- 📉 **Reverse-Rechner**: Zielbetrag → Zeitpunkt berechnen
- 🖼️ **Export**: Share-Cards als Post (1:1) oder Story (9:16)
- 📱 **PWA**: Offline-fähig, installierbar
- 🎨 **Dark/Light Mode**: Automatische Erkennung + manueller Toggle

## 🚀 Schnellstart

```bash
# Installieren
npm install

# Tests ausführen
npm test              # Unit Tests
npm run test:coverage # Coverage Report
npx playwright test   # E2E Tests

# Lokaler Server
npx serve . -p 3000
```

## 🛠️ Tech Stack

- **Frontend**: Vanilla JS, CSS Custom Properties
- **Design System**: MBRN Theme v4.0
- **Testing**: Vitest (Unit) + Playwright (E2E)
- **API**: CoinGecko (optional, mit Fallback)
- **PWA**: Service Worker, Manifest, Cache-Strategie

## 📁 Projektstruktur

```
FinanzRechner/
├── index.html          # Hauptseite
├── app.js             # Core-Logik (~43KB)
├── style.css          # Tool-spezifische Styles
├── manifest.json      # PWA Manifest
├── sw.js              # Service Worker
├── impressum.html     # Impressum
├── datenschutz.html   # Datenschutz
├── tests/             # Unit Tests
│   └── finance.test.js
├── e2e/               # E2E Tests
│   └── core.spec.js
├── package.json       # Dependencies & Scripts
├── vitest.config.js   # Test-Config
└── playwright.config.js
```

## 🔒 Architektur

**Local-First**: Alle Berechnungen im Browser. Keine Daten verlassen das Gerät (außer API-Calls für Live-Kurse).

## 📝 Changelog

### v1.4.0 (Current)
- Enhanced Inflation-Integration (Hauptwert, Details, Chart)
- PWA Support (Manifest + Service Worker)
- Shared Navigation Integration
- Performance Optimierungen (Font Preload)
- Test-Infrastruktur (Vitest + Playwright)

### v1.3.0
- Theme Toggle (Dark/Light Mode)
- Share-Card Export (Post & Story)
- CSP & Security Headers

## 🔗 Links

- **Live**: https://mbrn-flase.github.io/FinanzRechner/
- **MBRN Hauptseite**: https://mbrn-flase.github.io/MBRN/
- **Support**: https://ko-fi.com/flasembrn

## 📄 Lizenz

MIT © Erik Klauß
