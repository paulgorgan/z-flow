---
mode: agent
description: Z-FLOW UX improvements — desktop & mobile display audit v75.34
---

# Z-FLOW UX Audit — Îmbunătățiri identificate

Optimizări rămase după auditul complet al `index.html` + `css/styles.css` (v75.34).

**Reguli de lucru:**
- Nu șterge și nu modifică funcționalitățile existente
- Intervine strict scoped în CSS sau HTML, fără refactoring JS
- După fiecare grup de modificări: `node --check` pe JS-urile modificate + bump SW

---

## Grup 1 — Text micro-label în BI Totale Bar

**Fișier:** `index.html`

Labelele din `#bi-totale-bar` folosesc `text-[7px]` care pe desktop (unde sunt deja 9px prin regula din CSS) sunt ok, dar `tracking-widest` le face totuși înguste. Adaugă clasa `md:tracking-wide` la cele 3 span-uri de label din `#bi-totale-bar` pentru a reduce letter-spacing excesiv pe ecrane mai mari.

Elementele vizate:
```html
<span class="text-[7px] font-semibold text-blue-700 uppercase tracking-widest">Ieșiri clienți</span>
<span class="text-[7px] font-semibold text-red-700 uppercase tracking-widest">Intrări furnizori</span>
<span class="text-[7px] font-semibold text-slate-400 uppercase tracking-widest">Diferență</span>
```
Modificare: adaugă `md:tracking-wide` fiecăruia.

---

## Grup 2 — KPI Home: card „Net cashflow" înălțime fixă prea mică

**Fișier:** `css/styles.css`

`#home-kpi-net` are `height: 28px !important; min-height: 28px !important; line-height: 28px !important` — aceasta poate trunchie valori cu prefix negativ lung (ex: `-12.345 lei`). 

Modificare: înlocuiește cu:
```css
#home-kpi-net {
  height: auto !important;
  min-height: 28px !important;
  line-height: 1.2 !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

## Grup 3 — Dark mode: `pill-nav` background pe tablet/mobile

**Fișier:** `css/styles.css`

În dark mode, `.pill-nav` are `background-color: #1e293b !important` global, dar pe mobile (max-width: 640px) există o regulă care setează `overflow-x: hidden !important` pe `#financiar .pill-nav` etc. Această combinație poate ascunde vizual scroll-ul pe mobile dark. 

Verifică și adaugă dacă lipsește:
```css
@media (max-width: 640px) {
  .dark #financiar .pill-nav,
  .dark #logistic .pill-nav,
  .dark #depozit .pill-nav {
    background-color: #1e293b !important;
    border: 1px solid #334155;
  }
}
```

---

## Grup 4 — `view-detalii` / `view-detalii-furnizor`: card header desktop

**Fișier:** `css/styles.css`

Pe desktop, `#card-detaliu` și `#card-detaliu-furnizor` au `max-width: 900px` fiecare, dar bara de acțiuni (Înapoi + Editare Profil) are `justify-content: center !important; gap: 24px !important` fără un max-width explicit pe container — rezultând în butonele centrate pe 100% din lățimea disponibilă.

Adaugă în blocul `@media (min-width: 1024px)`:
```css
#card-detaliu,
#card-detaliu-furnizor {
  max-width: 900px !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
```
(E posibil să existe deja — verifică înainte de a adăuga.)

---

## Grup 5 — Depozit KPI grid: valoare stoc trunchi pe mobil mic

**Fișier:** `css/styles.css`

`#depozit-kpi-valoare` afișează `text-2xl font-black tabular-nums` + " lei" — pe ecrane <380px se poate trunchie. Regula `clamp(0.75rem, 4vw, 1.5rem)` aplicată prin `.grid.grid-cols-3 .card-flow > p:first-child` nu acoperă `#depozit-kpi-valoare` (care e `p` al doilea, nu primul).

Modificare în blocul `@media (max-width: 379px)`:
```css
#depozit-kpi-valoare {
  font-size: clamp(0.65rem, 3.5vw, 1rem) !important;
}
```

---

## Grup 6 — `bottom-nav` pe 1440px+: padding asimetric

**Fișier:** `css/styles.css`

În blocul `@media (min-width: 1440px)`, `.bottom-nav` are:
```css
padding: 16px 24px 28px 24px;
```
Pe desktop, nav-ul este la TOP (nu bottom), deci `padding-bottom: 28px` este incorect (creat pentru safe-area iOS). Înlocuiește cu padding simetric:
```css
@media (min-width: 1440px) {
  .bottom-nav {
    padding: 16px 24px !important;
  }
}
```

---

## Grup 7 — `#card-contributii-mobile` — denumire id incorectă pe desktop

**Observație**: ID-ul `card-contributii-mobile` sugerează "mobile only" dar se afișează pe toate breakpoint-urile. Nu necesită modificare funcțională, dar dacă se dorește redenumire pentru claritate: înlocuiește ID-ul `card-contributii-mobile` cu `card-contributii` în tot codul (index.html + js/). Aceasta este o refactorizare opțională — nu este un bug.

---

## Grup 8 — `main` margin-top desktop comentariu greșit

**Fișier:** `css/styles.css`

Comentariul `/* Compensare: header (~68px) + nav (~58px) = 126px */` precede `main { margin-top: 58px !important; }` — comentariul este de fapt corect: header-ul sticky (68px) plus margin-ul (58px) = 126px total de la viewport top. Comentariul poate fi clarificat:

```css
/* Header sticky: 68px (natural flow) + nav fixat la top:68px înălțime ~58px → main începe la 126px */
main {
  margin-top: 58px !important;
```

Modificare cosmetic — nu afectează comportamentul.

---

## Grup 9 — `#bi-firme-collapse` scroll custom pe dark mode

**Fișier:** `css/styles.css`

Div-urile `#container-bi-checks` și `#container-bi-furnizori-checks` au `max-h-44 overflow-y-auto custom-scroll`. Clasa `.custom-scroll` are `scrollbar-color: #cbd5e1 transparent` — pe dark mode textul scrollbar-ului este luminos pe fundal întunecat, dar thumb-ul (cbd5e1) este prea luminos.

Adaugă:
```css
.dark .custom-scroll {
  scrollbar-color: #475569 transparent;
}
.dark .custom-scroll::-webkit-scrollbar-thumb {
  background: #475569;
}
```

---

## Grup 10 — `z-index: 0` duplicat în `#map`

**Fișier:** `css/styles.css`

`#map` are `z-index: 0` urmat imediat de `z-index: 10` — prima declarație este redundantă.

```css
/* CURENT (redundant): */
#map {
  z-index: 0;        /* ← de șters */
  border-radius: 24px;
  z-index: 10;
  ...
}
```

Curăță declarația duplicată.

---

*Generat de auditul complet al Z-FLOW v75.34 — toate funcționalitățile existente au fost păstrate.*
