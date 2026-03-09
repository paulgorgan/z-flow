# Z-FLOW — Arhitectura Aplicației

## Privire de ansamblu

Z-FLOW este o aplicație **SPA (Single-Page Application)** de tip PWA, construită fără un framework de build. Rulează complet în browser, cu persistență prin **Supabase** (cloud) sau **localStorage** (modul offline/demo).

```
index.html  ←──  unica pagină HTML — conține tot șablonul UI
    │
    ├── css/styles.css          ← stiluri globale (Tailwind override + custom)
    ├── js/store.js             ← stare reactivă globală (Vue.reactive)
    ├── js/app.js               ← bootstrap, inițializare, handler-e de tab
    ├── js/services/
    │   ├── supabase.js         ← layer acces date (Supabase + fallback local)
    │   └── idb.js              ← IndexedDB (cache offline extins)
    └── js/modules/             ← module UI specializate
        ├── ui.js, auth.js, utils.js
        ├── clients.js, suppliers.js, invoices.js
        ├── analytics.js, export.js, import.js
        ├── depozit.js, logistic.js
        ├── attachments.js, notifications.js
        ├── mobile.js, bulk.js, anaf.js, features.js
        └── index.js            ← re-exporturi, inițializare module
```

---

## Fluxul de date

### 1. Inițializare sesiune

```
app.js: init()
  └─► auth.js: verificaAuth() / getSession()
        └─► supabase.js: signIn() sau getSession()
              └─► ZFlowStore.userSession = { user, isDemo }
                    └─► app.js: afterLogin()
                          ├─► fetchClienti(), fetchFacturi(), ...  (supabase.js)
                          └─► store.date* = date încărcate
```

### 2. Citire date (fetch)

```
Modul (ex. clients.js) sau app.js
    └─► supabase.js: fetchClienti()
          ├─► [dacă local/demo] → _demoOps.fetchXxx() → ZFlowStore._demoXxx[]
          └─► [dacă Supabase]   → withRetry(() => zf.from('clienti').select(*))
                │  (1→2→4s exponential backoff, max 3 reîncercări)
                └─► ZFlowStore.dateLocal = data
                      └─► renderClienti()  ← UI renderizat din Store
```

### 3. Scriere date (insert / update / delete)

```
Modul UI (buton "Salvează")
    └─► supabase.js: insertFactura(payload)
          ├─► [demo/admin] → _demoOps.insertFactura() + localStorage persist
          └─► [Supabase]   → zf.from('facturi').insert([payload])
                └─► [eroare] fallback graceful la _demoOps (dacă strict=false)
                      └─► ZFlowUI.showNotification()
```

### 4. Storage fișiere (PDF atașamente)

```
attachments.js: uploadPending(facturaId)
    └─► zf.storage.from('zflow-uploads').upload(...)
          └─► URL public → salvat în factura.pdf_url (JSON array sau string)

ștergere factură:
    └─► attachments.js: deleteAttachmentsForFactura(id, pdf_url)
          └─► zf.storage.from('zflow-uploads').remove([path])

mentenanță periodică:
    └─► attachments.js: cleanupOrphanedFiles()
          ├─► listează toate fișierele din bucket
          ├─► compară cu pdf_url-urile active din DB
          └─► șterge fișierele care nu sunt referențiate
```

### 5. Realtime (Supabase Postgres Changes)

```
supabase.js: initRealtimeSubscriptions()
    └─► zf.channel('zflow-realtime-v1')
          ├─► ON clienti   → fetchClienti()  → ZFlowStore.dateLocal   → renderClienti()
          ├─► ON facturi   → fetchFacturi()  → ZFlowStore.dateFacturiBI → renderFacturi()
          ├─► ON furnizori → fetchFurnizori()→ ZFlowStore.dateFurnizori → renderFurnizori()
          └─► ON facturi_platit → fetchFacturiPlatit() → ...
```

---

## ZFlowStore — State Management

`store.js` expune un obiect **Vue.reactive** global (`ZFlowStore`) — singura sursă de adevăr pentru toate datele din memorie.

| Proprietate               | Tip     | Conținut                                        |
|---------------------------|---------|-------------------------------------------------|
| `dateLocal`               | Array   | Clienți                                         |
| `dateFacturiBI`           | Array   | Facturi de încasat (clienți)                    |
| `dateFurnizori`           | Array   | Furnizori                                       |
| `dateFacturiPlatit`       | Array   | Facturi de plătit (furnizori)                   |
| `dateProduse`             | Array   | Produse depozit                                 |
| `dateMiscariStoc`         | Array   | Mișcări stoc (intrări/ieșiri)                   |
| `dateReceptii`            | Array   | Documente recepție                              |
| `dateLivrari`             | Array   | Documente livrare                               |
| `dateSoferi`              | Array   | Șoferi logistică                                |
| `dateVehicule`            | Array   | Vehicule parc auto                              |
| `dateComenziTransport`    | Array   | Comenzi transport                               |
| `userSession`             | Object  | Sesiunea curentă (`user`, `isDemo`)             |
| `userProfile`             | Object  | Profilul firmei (din `profiles` Supabase)       |
| `isLoading`               | Boolean | Indicator loader global                         |
| `currentTab`              | String  | Tab-ul activ din navigație                      |
| `_clientiFiltrati`        | Array   | Cache date filtrate (paginare clienți)          |
| `_demoClienti` etc.       | Array   | Date in-memory pentru modul demo/admin          |

---

## Supabase Service (supabase.js)

Toate operațiile DB sunt centralizate în `supabase.js`. Fiecare funcție are **trei ramuri**:

```
isDemo()     → _demoOps (date volatile, se șterg la logout)
isAdminLocal()→ _demoOps + _adminLS (date persistate în localStorage)
altfel       → Supabase cloud (RLS per user_id)
```

### Tabele Supabase

| Tabelă              | Modul principal    | RLS                       |
|---------------------|--------------------|---------------------------|
| `profiles`          | auth.js            | `id = auth.uid()`         |
| `clienti`           | clients.js         | `user_id = auth.uid()`    |
| `facturi`           | invoices.js        | `user_id = auth.uid()`    |
| `facturi_platit`    | invoices.js        | `user_id = auth.uid()`    |
| `furnizori`         | suppliers.js       | `user_id = auth.uid()`    |
| `produse`           | depozit.js         | `user_id = auth.uid()`    |
| `miscari_stoc`      | depozit.js         | `user_id = auth.uid()`    |
| `receptii`          | depozit.js         | `user_id = auth.uid()`    |
| `livrari`           | depozit.js         | `user_id = auth.uid()`    |
| `soferi`            | logistic.js        | `user_id = auth.uid()`    |
| `vehicule`          | logistic.js        | `user_id = auth.uid()`    |
| `comenzi_transport` | logistic.js        | `user_id = auth.uid()`    |

### Storage Buckets

| Bucket            | Utilizat în           | Descriere                             |
|-------------------|-----------------------|---------------------------------------|
| `facturi-pdf`     | invoices.js           | PDF-uri generate pentru facturi       |
| `zflow-uploads`   | attachments.js        | Fișiere PDF atașate manual la facturi |

---

## Module UI (js/modules/)

Fiecare modul expune un obiect global sau funcții globale, fără ES Modules native.

| Modul              | Export global        | Responsabilitate principală                    |
|--------------------|----------------------|------------------------------------------------|
| `ui.js`            | `ZFlowUI`            | Skeleton screens, notificări toast, modals     |
| `auth.js`          | `ZFlowAuth`          | Rate limiting login, gestionare sesiune        |
| `clients.js`       | `ZFlowClients`       | Filtrare, căutare, KPI-uri per client          |
| `suppliers.js`     | `ZFlowSuppliers`     | Filtrare furnizori, totaluri                   |
| `invoices.js`      | `ZFlowInvoices`      | Filtrare facturi, calcule scadențe             |
| `analytics.js`     | `ZFlowAnalytics`     | KPI dashboard, cashflow chart, export BI       |
| `attachments.js`   | `ZFlowAttachments`   | Upload PDF, drag & drop, cleanup storage       |
| `export.js`        | `ZFlowExport`        | Generare PDF (jsPDF) și Excel (xlsx)           |
| `import.js`        | `ZFlowImport`        | Import CSV/Excel în Supabase                   |
| `notifications.js` | `ZFlowNotifications` | Scadențe, notificări browser                   |
| `mobile.js`        | `ZFlowMobile`        | Swipe gestures, layout adaptiv mobil           |
| `bulk.js`          | `ZFlowBulk`          | Operații în masă (ștergere, export multiplu)   |
| `anaf.js`          | `ZFlowANAF`          | Interogare API ANAF (CUI → date firmă)         |
| `features.js`      | `ZFlowFeatures`      | Feature flags, onboarding checklist            |
| `depozit.js`       | *(funcții globale)*  | Stoc, produse, recepții, livrări, scanner QR   |
| `logistic.js`      | *(funcții globale)*  | Comenzi transport, șoferi, vehicule, tracking  |
| `utils.js`         | *(funcții globale)*  | debounce, formatare date/sume, validări        |
| `index.js`         | *(bootstrap)*        | Inițializare module, event listeners globali   |

---

## Service Worker (sw.js)

Strategie **Cache First** pentru shell-ul aplicației:

```
Prima vizită:
  install → cache STATIC_ASSETS (index.html, styles.css, JS, icoane)
  activate → șterge cache-urile vechi

Fetch:
  navigate / .html  → Cache First + revalidare în background (stale-while-revalidate)
  CDN assets        → Cache First (nu expiră între versiuni)
  JS/CSS/icoane     → Cache First (invalidat la schimbarea CACHE_NAME)
  Supabase API      → bypass complet (niciodată cacheuit)
```

Actualizarea aplicației se face prin schimbarea `CACHE_NAME` în `sw.js` — noul service worker șterge cache-ul vechi și îl înlocuiește în `activate`.

---

## Securitate

- **RLS (Row Level Security)**: fiecare rând din Supabase este izolat prin `user_id = auth.uid()`. Cheia `anon` publică nu poate accesa datele altor utilizatori.
- **Rate limiting login**: `ZFlowAuth` blochează contul după 5 încercări eșuate timp de 5 minute (client-side, complementar cu protecțiile Supabase Auth).
- **Validare fișiere**: `ZFlowAttachments` permite exclusiv PDF-uri sub 10 MB, verificat înainte de upload.
- **XSS**: toate valorile inserate în HTML folosesc `innerText` sau escape manual. Template literal-ele cu date utilizator folosesc atribuite `data-*` cu valori sanitizate.
- **CSRF**: nu este relevant pentru SPA-uri fără cookies de sesiune server-side. Supabase Auth folosește JWT în localStorage.

---

## Convenții cod

- State global: luat întotdeauna din `ZFlowStore.*`, niciodată stocat în variabile module-scoped care supraviețuiesc re-render-ului.
- Operații DB: exclusiv prin funcțiile din `supabase.js` (niciodată `zf.*` apelat direct din module UI).
- Erori: operațiile de citire afișează `ZFlowUI.showNotification(msg, 'error')`. Operațiile de scriere aruncă `Error` pe care module-ul apelant îl prinde și afișează.
- Retry: `withRetry(fn, 3, 1000)` învelește automat operațiile de citire Supabase cu backoff 1s → 2s → 4s.
