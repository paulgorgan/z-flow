# Z-FLOW v71.3 — Ghid Import Smart Unificat (SAGA / WinMentor / XML)

## Ce s-a schimbat

Cele 3 butoane separate de import (Clienți, Furnizori, Contribuții) au fost **înlocuite cu un singur buton**
"Import SAGA / WinMentor" care detectează automat tipul fișierului și distribuie datele corect.

---

## Cum funcționează detecția automată

| Fișier | Ce detectează | Unde ajung datele |
|--------|--------------|-------------------|
| CSV/Excel cu header `FURNIZOR` sau `PLATIT` | Furnizori | Tab Furnizori → Facturi de Plătit |
| CSV/Excel cu header `DENUMIRE` + `NR. FACTURA` | Clienți | Tab Financiar → Clienți → Facturi de Încasat |
| CSV/Excel cu header `tip` + `suma` + `luna` | Contribuții | Tab Furnizori → Contribuții Buget Stat |
| XML cu `FurnizorCIF` = CUI-ul firmei tale | Facturi emise → Clienți | Tab Financiar → Clienți |
| XML cu `ClientCIF` = CUI-ul firmei tale | Facturi primite → Furnizori | Tab Furnizori |

> **Important pentru XML:** Completează CUI-ul firmei tale în **Profil Firmă** (iconiță user → Profil Firmă → câmpul CUI).
> Fără CUI completat, Z-Flow nu poate determina automat dacă factura XML e emisă sau primită.

---

## Fișiere de test incluse

### Format SAGA (CSV cu `;` delimiter)
- `TEST_SAGA_clienti_facturi_incasat.csv` — 21 facturi, 10 clienți
  - Header: `DENUMIRE;CUI;NR. FACTURA;DATA EMITERE;DATA SCADENTA;VALOARE;STATUS;NOTE`
- `TEST_SAGA_furnizori_facturi_platit.csv` — 26 facturi, 10 furnizori
  - Header: `FURNIZOR;CUI;NR. FACTURA;DATA EMITERE;DATA SCADENTA;VALOARE;STATUS;NOTE`
- `TEST_SAGA_contributii_buget.csv` — 20 înregistrări (TVA, CAS, CASS, Impozit, Altele)
  - Header: `tip;suma;luna;achitat;observatii`

### Format WinMentor (CSV cu `;` delimiter, headere diferite)
- `TEST_WinMentor_clienti.csv` — 7 facturi
  - Header: `COD FISCAL;PARTENER;NR. DOC;DATA DOC;SCADENTA;TOTAL;ACHITAT;EXPLICATII`
- `TEST_WinMentor_furnizori.csv` — 6 facturi
  - Header: `COD FISCAL;PARTENER;NR. DOC;DATA DOC;SCADENTA;TOTAL;PLATIT;EXPLICATII`
  - Coloana `PLATIT` declanșează detecția ca furnizori

### Format XML SAGA nativ
- `TEST_XML_SAGA_factura_emisa.xml` — 3 facturi emise (FurnizorCIF = RO99887766)
  - Înainte de import, setează CUI-ul firmei tale la `RO99887766` în Profil Firmă
- `TEST_XML_SAGA_factura_primita.xml` — 3 facturi primite (ClientCIF = RO99887766)
  - Înainte de import, setează CUI-ul firmei tale la `RO99887766` în Profil Firmă

---

## Firme duale (client ȘI furnizor simultan)

Aceste firme apar în ambele fișiere de test (clienti + furnizori) pentru a testa
badge-ul „Client + Furnizor" și alertele cross-module:

| Firmă | CUI | Ca client | Ca furnizor |
|-------|-----|-----------|-------------|
| TEHNO CONSTRUCT SRL | RO12345678 | 3 facturi | 3 facturi |
| METAL GRUP SRL | RO34567890 | 2 facturi | 2 facturi |
| AGRO PRODUSE SA | RO23456789 | 3 facturi | 2 facturi |
| EUROCOM TRADING SRL | RO67890123 | 2 facturi | 2 facturi |
| FOOD DISTRIBUTION SA | RO89012345 | 3 facturi | 2 facturi |
| SMART IT SOLUTIONS SRL | RO56789012 | 2 facturi | 2 facturi |
| TRANSPORT EXPRESS SRL | RO45678901 | 3 facturi | 2 facturi |

---

## Ordinea recomandată de import pentru testare completă

1. **Import clienți** → `TEST_SAGA_clienti_facturi_incasat.csv`
2. **Import furnizori** → `TEST_SAGA_furnizori_facturi_platit.csv`
3. **Import contribuții** → `TEST_SAGA_contributii_buget.csv`
4. **(Opțional) WinMentor clienți** → `TEST_WinMentor_clienti.csv` *(va actualiza status pt. firmele existente)*
5. **(Opțional) XML emis** → `TEST_XML_SAGA_factura_emisa.xml` *(după setare CUI în Profil)*

---

## Ce să verifici după import

- **Tab Home:** KPI-urile (Facturat, Neîncasat, Neplătit, Net) să reflecte valorile importate
- **Tab Financiar → Clienți:** firmele din CSV clienți să apară cu facturile lor
- **Badge „Client + Furnizor":** pe cele 7 firme duale să apară badge-ul special
- **Tab Financiar → Furnizori:** firmele din CSV furnizori să apară cu facturile lor
- **Tab Furnizori → Contribuții Buget Stat:** cele 20 înregistrări să fie vizibile
- **Alerte Home:** firmele cu scadențe depășite să apară în secțiunea Alerte
- **Cashflow Analiză:** selectează o perioadă și verifică că suma clienți + furnizori + contribuții e corectă

---

## Logica de detecție în cod (`js/app.js` — funcția `importSmartUnificat`)

```
1. Extensie .xml → _importSmartXML(file)
   └── Compară FurnizorCIF cu userProfile.cui
       ├── Match → facturi EMISE → importaDateSaga('clienti')
       └── Nu match → compară ClientCIF cu userProfile.cui
           ├── Match → facturi PRIMITE → importaDateSaga('furnizori')
           └── Fallback → detectare din numele fișierului

2. Extensie .csv/.xlsx
   ├── headers include 'tip' + 'suma' + 'luna' → importaContributiiCSV()
   ├── headers include 'furnizor' sau 'platit' → importaDateSaga('furnizori')
   └── Default → importaDateSaga('clienti')
```
