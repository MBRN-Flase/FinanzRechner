# MBRN Design System v4.0 — "CLARITY"
## Visuelle Hierarchie & Nutzerführung

---

## 1. DAS 3-EBENEN-HIERARCHIE-SYSTEM

### L1 — PRIMARY (Wichtig, sofort auffällig)
**Nutzen:** Call-to-Actions, Haupt-Headlines, primäre Buttons

| Token | Wert | Verwendung |
|-------|------|------------|
| `--text-primary` | `#ffffff` / `#1a1a1a` (100%) | Haupt-Überschriften, CTAs |
| `--text-primary-accent` | `#8b5cf6` | Akzent-Highlights |
| `--bg-primary-action` | `#8b5cf6` | Primary Button Hintergrund |
| `--border-primary` | `#8b5cf6` | Starke Umrandungen |

**Klassen:**
- `.mbrn-text--primary` / `.text-primary`
- `.mbrn-btn--primary` / `.btn--primary` (Standard-Button)
- `.mbrn-eyebrow--primary`

**Design:**
- 2px Border (dicker = wichtiger)
- `--accent-soft` Hintergrund
- Voller Kontrast (100%)
- Hover: Glow-Effekt + Farbwechsel zu Akzent

---

### L2 — SECONDARY (Info, klar lesbar)
**Nutzen:** Beschreibungen, Labels, sekundäre Buttons, Cards

| Token | Wert | Verwendung |
|-------|------|------------|
| `--text-secondary` | `rgba(255,255,255,0.70)` / `rgba(26,26,26,0.70)` | Fließtext, Labels |
| `--text-secondary-accent` | `#b7b7b7` / `#707070` | Dezente Akzente |
| `--bg-secondary` | `rgba(20,20,20,0.95)` | Card-Hintergrund |
| `--border-secondary` | `rgba(255,255,255,0.12)` | Standard-Borders |

**Klassen:**
- `.mbrn-text` / `.text` (Standard)
- `.mbrn-text--secondary`
- `.mbrn-btn--secondary` / `.btn--secondary`
- `.mbrn-card` / `.card`
- `.mbrn-eyebrow`

**Design:**
- 1px Border (dünner = weniger wichtig)
- `--card` Hintergrund
- 70% Opacity (immer noch klar lesbar)
- Standard für alle Inhalte

---

### L3 — TERTIARY (Dezent, aber lesbar)
**Nutzen:** Hints, Meta-Informationen, optionale Details

| Token | Wert | Verwendung |
|-------|------|------------|
| `--text-tertiary` | `rgba(255,255,255,0.50)` / `rgba(26,26,26,0.50)` | Hints, Placeholder |
| `--text-tertiary-accent` | `#b7b7b7` / `#707070` | Icons, Meta-Text |
| `--bg-tertiary` | `#0a0a0a` / `#f5f5f5` | Subtile Hintergründe |
| `--border-tertiary` | `rgba(255,255,255,0.06)` | Sehr dezente Borders |

**Klassen:**
- `.mbrn-text--tertiary` / `.text-tertiary`
- `.mbrn-btn--tertiary` / `.btn--ghost`
- `.mbrn-text-dim`

**Design:**
- Transparente/keine Border
- Kleinere Schrift (13px)
- 50% Opacity (Minimum für Lesbarkeit!)
- Keine Animationen

---

## 2. NUTZERFÜHRUNG DURCH FOKUS-STATES

### Fokus-Ring (Accessibility)
```css
:focus-visible {
  outline: 3px solid var(--accent-main);
  outline-offset: 3px;
}
```

**Verwendung:**
- Alle interaktiven Elemente (Buttons, Inputs, Links)
- 3px Dicke (deutlich sichtbar)
- 3px Offset (nicht überdeckt Element)
- Akzent-Farbe (konsistent)

### Hover-Hierarchie
| Ebene | Hover-Effekt | Ziel |
|-------|--------------|------|
| L1 Primary | `translateY(-2px)` + Glow | Auffälligkeit |
| L2 Secondary | Border-Farbe + Hintergrund | Feedback |
| L3 Tertiary | Subtile Border | Bestätigung |

### Z-Index Skala
```css
--z-background: -1
--z-base:        0
--z-dropdown:   100
--z-sticky:     200
--z-nav:        500
--z-modal:      1000
--z-toast:      1100
--z-tooltip:    1200
```

---

## 3. TYPOGRAPHIE-HIERARCHIE

### Schriftgrößen
| Level | Size | Verwendung |
|-------|------|------------|
| Display-1 | `clamp(40px, 10vw, 64px)` | Hero-Headlines (L1) |
| H1 | `38px` | Seiten-Titel (L1) |
| H2 | `30px` | Section-Titel (L1/L2) |
| H3 | `24px` | Card-Titel (L2) |
| Large | `20px` | Wichtige Labels (L2) |
| Base | `17px` | Standard-Text (L2) |
| Small | `15px` | Sekundär-Text (L2) |
| XS | `13px` | Tertiär, Hints (L3) |

### Schriftgewichte
| Gewicht | Verwendung |
|---------|------------|
| 800 (Extra Bold) | Display, Hero |
| 700 (Bold) | Headlines, Buttons, Eyebrows |
| 600 (Semi Bold) | Labels, Badges |
| 500 (Medium) | Wichtiger Fließtext |
| 400 (Regular) | Standard-Fließtext |

---

## 4. BUTTON-HIERARCHIE (Beispiele)

### L1 — CTA Button (Wichtigste Aktion)
```html
<button class="mbrn-btn--primary mbrn-btn--lg">
  Berechnen
</button>
```
- 2px Akzent-Border
- Hintergrund-Farbe
- Größere Padding
- Glow auf Hover

### L2 — Option Button (Auswahl)
```html
<button class="mbrn-btn--secondary">
  Option wählen
</button>
```
- 1px Standard-Border
- Card-Hintergrund
- Normale Größe
- Border-Highlight auf Hover

### L3 — Ghost Button (Optional)
```html
<button class="mbrn-btn--tertiary">
  Mehr erfahren →
</button>
```
- Keine Border
- Transparent
- Kleinere Schrift
- Subtile Border auf Hover

---

## 5. TEXT-HIERARCHIE (Beispiele)

### L1 — Wichtige Info
```html
<h1 class="mbrn-display-1">Dein Ergebnis</h1>
<p class="mbrn-text--primary">€ 150.000</p>
```

### L2 — Standard Info
```html
<p class="mbrn-text">
  Diese Berechnung zeigt dein potenzielles Vermögen.
</p>
<span class="mbrn-eyebrow">Finanz-Rechner</span>
```

### L3 — Zusatz Info
```html
<p class="mbrn-text--tertiary">
  *Ohne Gewähr. Steuern nicht berücksichtigt.
</p>
```

---

## 6. FARBSYSTEM (Projekt-Spezifisch)

### FinanzRechner — Blau
```css
--feature-secondary: #38bdf8;
--feature-secondary-rgb: 56, 189, 248;
```
**Nutzen:** Vertrauen, Professionalität, Klarheit

### Discipline — Orange
```css
--feature-secondary: #f97316;
--feature-secondary-rgb: 249, 115, 22;
```
**Nutzen:** Energie, Motivation, Action

### Numerologie — Gold
```css
--feature-secondary: #f59e0b;
--feature-secondary-rgb: 245, 158, 11;
```
**Nutzen:** Spiritualität, Wärme, Premium

---

## 7. ABSTANDSSYSTEM (4px Grid)

| Token | Wert | Verwendung |
|-------|------|------------|
| `--space-1` | 4px | Inline-Spacing |
| `--space-2` | 8px | Enge Gruppen |
| `--space-3` | 12px | Button-Padding Y |
| `--space-4` | 16px | Standard-Gap |
| `--space-5` | 20px | Card-Padding |
| `--space-6` | 24px | Section-Gap |
| `--space-8` | 32px | Große Sektionen |

---

## 8. RESPONSIVE BREAKPOINTS

```css
/* Mobile First */
@media (max-width: 480px) {
  .mbrn-container { padding: 80px 16px 60px; }
  .mbrn-nav { height: 56px; }
}

/* Tablet */
@media (max-width: 640px) {
  .mbrn-grid--2,
  .mbrn-grid--3 { grid-template-columns: 1fr; }
}
```

---

## 9. CHECKLISTE: VISUELLE HIERARCHIE

### Bei jedem Element fragen:
- [ ] Ist es wichtig? → **L1** (Primary)
- [ ] Ist es Info? → **L2** (Secondary)
- [ ] Ist es optional? → **L3** (Tertiary)

### Kontrast prüfen:
- [ ] Nie unter 50% Opacity für Text
- [ ] Nie unter 70% für wichtige Info
- [ ] 100% für CTAs und Headlines

### Fokus prüfen:
- [ ] Alle Buttons haben Hover-State
- [ ] Alle Inputs haben Focus-Ring
- [ ] Z-Index ist korrekt gesetzt

---

## 10. BEISPIEL: VOLLSTÄNDIGE SEITE

```html
<!DOCTYPE html>
<html data-theme="dark">
<head>
  <link rel="stylesheet" href="../shared/styles/mbrn-theme.css">
  <link rel="stylesheet" href="../shared/styles/mbrn-finanz.css">
</head>
<body>
  <!-- L3: Background (Dekorativ) -->
  <div class="mbrn-bg-glow mbrn-bg-glow--1"></div>
  
  <!-- L1: Navigation (Wichtig) -->
  <nav class="mbrn-nav">
    <div class="mbrn-nav__brand">
      <span class="mbrn-nav__logo">✦</span>
      <span class="mbrn-nav__name">MBRN</span>
    </div>
    <div class="mbrn-nav__links">
      <a href="#" class="mbrn-nav__link">Link</a>
    </div>
  </nav>
  
  <!-- L2: Container -->
  <div class="mbrn-container">
    
    <!-- L2: Eyebrow -->
    <span class="mbrn-eyebrow">Finanz-Rechner</span>
    
    <!-- L1: Haupt-Headline -->
    <h1 class="mbrn-display-1">Dein Vermögen</h1>
    
    <!-- L2: Beschreibung -->
    <p class="mbrn-text">
      Berechne dein potenzielles Vermögen mit Zinseszins.
    </p>
    
    <!-- L2: Card -->
    <div class="mbrn-card">
      <!-- L2: Label -->
      <label class="mbrn-label">Startkapital</label>
      
      <!-- L1: Input (Wichtig) -->
      <input type="number" class="mbrn-input" value="10000">
      
      <!-- L3: Hint (Optional) -->
      <p class="mbrn-text--tertiary">
        Mindestens € 1.000 empfohlen
      </p>
    </div>
    
    <!-- L1: CTA Button -->
    <button class="mbrn-btn--primary mbrn-btn--full">
      Jetzt berechnen
    </button>
    
    <!-- L3: Meta-Info -->
    <p class="mbrn-text--tertiary mbrn-text-center">
      Alle Berechnungen erfolgen lokal im Browser.
    </p>
    
  </div>
</body>
</html>
```

---

## ZUSAMMENFASSUNG

**Das MBRN Design System v4.0 nutzt ein 3-Ebenen-Hierarchie-System:**

| Ebene | Kontrast | Verwendung | Border |
|-------|----------|------------|--------|
| **L1 Primary** | 100% | CTAs, Headlines | 2px Akzent |
| **L2 Secondary** | 70% | Info, Content | 1px Standard |
| **L3 Tertiary** | 50% | Hints, Meta | Keine/Transparent |

**Nutzerführung:**
- Klare Fokus-States (3px Ring)
- Hover-Feedback auf allen Ebenen
- Konsistente Z-Index Skala
- Projekt-spezifische Akzent-Farben

**Alle Elemente sind sofort unterscheidbar, klar lesbar und führen den Nutzer intuitiv durch die Seite.**
