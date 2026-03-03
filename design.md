# Aspen Design System

A dark-mode-only, tactical UI inspired by the Anduril Lattice aesthetic. Dense, precise, and technical — built for professionals working in data-heavy environments.

---

## Design Principles

1. **Single accent, dark neutrals** — one amber/gold accent against near-black backgrounds
2. **Density over whitespace** — compact components, tight spacing, maximum information per screen
3. **Visual hierarchy through surface layers** — four distinct background levels create depth without color
4. **Technical typographic aesthetic** — IBM Plex Sans/Mono, tight tracking, uppercase labels
5. **Consistent interactive states** — every element has explicit hover, active, focus, and disabled states

---

## Color Palette

### Backgrounds (4 levels)

```
--bg-main:     #0e0f13   (root / outermost)
--bg-surface:  #1c1d21   (panels, cards, inputs)
--bg-hover:    #25262a   (hover states)
--bg-panel:    #25262a   (card containers)
```

### Text

```
--text-primary:    #feffff   (main body text)
--text-secondary:  #a5a6aa   (supporting text, metadata)
--text-muted:      #737478   (disabled, labels, placeholders)
```

### Accent — Amber/Gold

```
--accent:        #ffba28
--accent-hover:  #f9b422
--accent-muted:  rgba(255, 186, 40, 0.15)   (backgrounds, selections)
```

### Borders

```
--border:        #333438   (default)
--border-light:  #525357   (hover / focus border)
```

### Shadow

```
--shadow: rgba(0, 0, 0, 0.5)
```

### Semantic Colors (used sparingly)

```
Green (active / success):     #22c55e   bg: rgba(34, 197, 94, 0.15)
Yellow (pending / warning):   #eab308   bg: rgba(234, 179, 8, 0.15)
Red (error / closed):         #ef4444   bg: rgba(239, 68, 68, 0.10)
Blue (Salesforce-linked):     #00a1e0   bg: rgba(0, 161, 224, 0.15)
Teal (production filter):     #2dd4bf   bg: rgba(45, 212, 191, 0.15)
```

### Stage/Pipeline Badge Colors

Each badge uses a muted 15% opacity background with the full-saturation foreground color.

| Stage                 | Color     | Background                     |
|-----------------------|-----------|--------------------------------|
| Lead                  | #94a3b8   | rgba(148, 163, 184, 0.15)      |
| Qualification         | #60a5fa   | rgba(96, 165, 250, 0.15)       |
| Strategic Planning    | #a78bfa   | rgba(167, 139, 250, 0.15)      |
| Touring               | #34d399   | rgba(52, 211, 153, 0.15)       |
| Pursuit               | #fbbf24   | rgba(251, 191, 36, 0.15)       |
| Submitted Proposal    | #fb923c   | rgba(251, 146, 60, 0.15)       |
| Proposal Negotiation  | #f87171   | rgba(248, 113, 113, 0.15)      |
| Letter of Intent      | #4ade80   | rgba(74, 222, 128, 0.15)       |
| Lease Negotiation     | #2dd4bf   | rgba(45, 212, 191, 0.15)       |
| Tours / Marketing     | #818cf8   | rgba(129, 140, 248, 0.15)      |

---

## Typography

### Font Families

```css
--font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif
--font-mono: 'IBM Plex Mono', 'SF Mono', monospace
```

Import from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type Scale

| Role                      | Size  | Weight | Transform  | Letter-spacing |
|---------------------------|-------|--------|------------|----------------|
| Panel / Section Header    | 13px  | 600    | uppercase  | 0.8px          |
| Small label / tab header  | 11px  | 600    | uppercase  | 0.5–0.6px      |
| Tiny badge / meta label   | 10px  | 500    | uppercase  | 0.5px          |
| Body text                 | 13px  | 400    | —          | —              |
| Small body / metadata     | 12px  | 400    | —          | —              |
| Micro text                | 11px  | 400    | —          | —              |
| Card title / name         | 15px  | 600    | —          | —              |
| Page / modal heading      | 24px  | 600    | —          | —              |
| Code / monospace          | 12px  | 400    | —          | —              |

Line height for body text: **1.5**

---

## Spacing Scale

```
4px   — minimal gaps between tight elements
6px   — tight internal spacing
8px   — small padding, icon margins
10px  — standard small padding
12px  — standard spacing (nav items, internal card padding)
14px  — medium-small (header padding, panel items)
16px  — standard block padding
20px  — panel body padding
24px  — generous section spacing
32px  — large layout gaps
```

---

## Border Radius

```
--radius:    6px   (buttons, inputs, dropdowns)
--radius-lg: 8px   (cards, panels, modals)
             4px   (badges)
             3px   (small inline chips)
             50%   (status dots, avatars when circular)
```

---

## Transitions

```
--transition: 0.15s ease   (all interactive states)
```

---

## Shadows

```
Dropdown / popup:   0 4px 12px rgba(0, 0, 0, 0.5)
Selected card:      0 0 0 2px rgba(255, 186, 40, 0.3)
Hover card lift:    0 4px 12px rgba(0, 0, 0, 0.5)  + translateY(-2px)
```

---

## CSS Variable Setup

Paste this at the root of your global stylesheet:

```css
:root {
  /* Backgrounds */
  --bg-main:      #0e0f13;
  --bg-surface:   #1c1d21;
  --bg-hover:     #25262a;
  --bg-panel:     #25262a;

  /* Text */
  --text-primary:   #feffff;
  --text-secondary: #a5a6aa;
  --text-muted:     #737478;

  /* Accent */
  --accent:        #ffba28;
  --accent-hover:  #f9b422;
  --accent-muted:  rgba(255, 186, 40, 0.15);

  /* Borders */
  --border:        #333438;
  --border-light:  #525357;

  /* Shadow */
  --shadow: rgba(0, 0, 0, 0.5);

  /* Radii */
  --radius:    6px;
  --radius-lg: 8px;

  /* Transition */
  --transition: 0.15s ease;

  /* Typography */
  --font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SF Mono', monospace;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg-main);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

---

## Components

### Buttons

**Primary (Accent)**
```css
background: var(--accent);
color: #fff;  /* or dark color for contrast */
border: none;
border-radius: var(--radius);
padding: 10px 14px;
font-size: 13px;
font-weight: 500;
cursor: pointer;
transition: background var(--transition);

/* hover */
background: var(--accent-hover);

/* disabled */
opacity: 0.5;
cursor: default;
```

**Secondary / Ghost**
```css
background: var(--bg-surface);
color: var(--text-secondary);
border: 1px solid var(--border);
border-radius: var(--radius);
padding: 6px 12px;
font-size: 12px;
font-weight: 500;

/* hover */
background: var(--bg-hover);
color: var(--text-primary);
border-color: var(--border-light);

/* active / selected */
background: var(--accent-muted);
border-color: var(--accent);
color: var(--accent);
```

**Icon Button**
```css
width: 32px;
height: 32px;
background: transparent;
border: none;
border-radius: var(--radius);
color: var(--text-muted);

/* hover */
background: var(--bg-hover);
color: var(--text-primary);
```

---

### Inputs & Search

```css
background: var(--bg-surface);
color: var(--text-primary);
border: 1px solid var(--border);
border-radius: var(--radius);
padding: 6px 10px;
font-size: 13px;
font-family: var(--font-sans);
outline: none;
transition: border-color var(--transition);

/* focus */
border-color: var(--accent);

/* placeholder */
color: var(--text-muted);
```

Textarea (message input):
```
padding: 10px 12px;
min-height: 40px;
max-height: 120px;
resize: none;
```

---

### Cards

```css
background: var(--bg-panel);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
transition: all var(--transition);

/* Card header */
padding: 16px 20px;
background: var(--bg-surface);
border-bottom: 1px solid var(--border);

/* Card body */
padding: 16px 20px;

/* hover */
transform: translateY(-2px);
box-shadow: 0 4px 12px var(--shadow);

/* selected */
border-color: var(--accent);
box-shadow: 0 0 0 2px rgba(255, 186, 40, 0.3);
```

Card title: `font-size: 15px; font-weight: 600;`

---

### Badges & Tags

**Stage Badge**
```css
display: inline-block;
padding: 2px 8px;
border-radius: 4px;
font-size: 11px;
font-weight: 500;
letter-spacing: 0.3px;
/* color + background per stage — see Stage Color table above */
```

**Status Dot** (active / pending / closed)
```css
width: 10px;
height: 10px;
border-radius: 50%;

/* active */
background: #22c55e;
box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);

/* pending */
background: #eab308;
box-shadow: 0 0 8px rgba(234, 179, 8, 0.4);

/* closed / inactive */
background: var(--text-muted);
```

**Inline Chip / Count Badge**
```css
font-size: 11px;
font-weight: 600;
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: 10px;
padding: 1px 7px;
```

---

### Navigation / Sidebar

Three-panel layout:

| Zone         | Width (expanded) | Width (collapsed) |
|--------------|-----------------|-------------------|
| Left Sidebar | 200px           | 40px              |
| Main Content | flex: 1         | flex: 1           |
| Right Panel  | 380px           | 0 / hidden        |

**Sidebar**
```css
background: var(--bg-main);
border-right: 1px solid var(--border);
width: 200px; /* or 40px collapsed */
```

**Nav Tab**
```css
padding: 10px 12px;
font-size: 13px;
font-weight: 500;
color: var(--text-secondary);
border-radius: var(--radius);
cursor: pointer;
transition: all var(--transition);

/* hover */
background: var(--bg-hover);
color: var(--text-primary);

/* active — amber left-border indicator */
background: rgba(255, 186, 40, 0.08);
color: var(--accent);
/* ::before pseudo: width 3px, height 100%, background var(--accent), border-radius 0 2px 2px 0 */
```

---

### Panel Headers

```css
padding: 12px 20px;
background: var(--bg-surface);
border-bottom: 1px solid var(--border);

/* title */
font-size: 13px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.8px;
color: var(--text-primary);
```

Small section header (like chat panel, SF tabs):
```css
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.5px;
```

---

### Dropdowns & Popups

```css
background: var(--bg-surface);
border: 1px solid var(--border);
border-radius: var(--radius-lg);
box-shadow: 0 4px 12px var(--shadow);
max-height: 240px;
overflow-y: auto;
z-index: 100;

/* dropdown item */
padding: 8px 10px;
font-size: 13px;
cursor: pointer;

/* item hover */
background: var(--bg-hover);
color: var(--text-primary);
```

---

### Code Blocks & Inline Code

```css
/* inline */
code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

/* block */
pre {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 12px 14px;
  background: var(--bg-surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow-x: auto;
}
```

---

### Error / Warning States

```css
/* Error */
background: rgba(239, 68, 68, 0.10);
border: 1px solid rgba(239, 68, 68, 0.30);
color: #ef4444;
padding: 8px 12px;
border-radius: var(--radius);
font-size: 12px;

/* Warning banner (full-width) */
background: #c41e3a;
color: white;
padding: 8px 16px;
font-size: 14px;
font-weight: 500;
letter-spacing: 0.02em;
```

---

### Loading States

**Spinner**
```css
width: 32px;
height: 32px;
border: 3px solid var(--border);
border-top-color: var(--accent);
border-radius: 50%;
animation: spin 0.8s linear infinite;
```

**Skeleton shimmer**
```css
height: 12px;
border-radius: 4px;
background: linear-gradient(
  90deg,
  var(--bg-surface) 25%,
  var(--bg-hover) 50%,
  var(--bg-surface) 75%
);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

**Loading dots (3-dot bounce)**
```css
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: bounce 1.4s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
```

---

### Citations / Inline References

```css
display: inline;
background: rgba(255, 186, 40, 0.20);
color: var(--accent);
padding: 1px 4px;
border-radius: 3px;
font-size: 12px;
font-weight: 600;
cursor: pointer;

/* hover */
background: rgba(255, 186, 40, 0.40);
color: white;
```

---

### Avatars / Message Icons

```css
width: 28px;
height: 28px;
border-radius: var(--radius);   /* square-rounded, not circular */
font-size: 12px;
font-weight: 600;
display: flex;
align-items: center;
justify-content: center;

/* user avatar */
background: var(--accent);
color: white;

/* assistant avatar */
background: var(--bg-surface);
color: var(--text-primary);
border: 1px solid var(--border);
```

---

### Scrollbars

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--border-light);
}
```

---

## Animations

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40%           { transform: scale(1); opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

---

## Stack / Dependencies

| Library        | Package                  | Notes                                  |
|----------------|--------------------------|----------------------------------------|
| UI framework   | React 18                 |                                        |
| Icons          | lucide-react             | Consistent stroke-style icon set       |
| Maps           | maplibre-gl              | Open-source MapLibre (not Mapbox)      |
| Markdown       | react-markdown + remark-gfm | For rendering AI chat output        |
| Build tool     | Vite 5                   |                                        |
| Styling        | Plain CSS with variables | No Tailwind, no CSS-in-JS              |

---

## Quick-Start Checklist

When starting a new project using this design system:

- [ ] Import IBM Plex Sans and IBM Plex Mono from Google Fonts (weights 400, 500, 600)
- [ ] Paste CSS variable block into `globals.css`
- [ ] Set `body` background to `var(--bg-main)` and font to `var(--font-sans)`
- [ ] Add thin scrollbar styles globally
- [ ] Use `var(--accent)` (#ffba28) as the single highlight color — do not introduce additional accent colors
- [ ] Build all text labels at the small end of the scale (11–13px) with uppercase + tracking for headers
- [ ] Use square-rounded borders (6px) for interactive elements, 8px for containers
- [ ] Keep transitions at 0.15s ease for all hover/focus states
