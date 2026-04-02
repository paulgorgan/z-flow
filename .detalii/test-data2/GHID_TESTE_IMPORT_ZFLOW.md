# GHID TESTE Z-FLOW — Fișiere de Import
## Acoperire completă funcții testate la import

---

## CONFIGURARE PREALABILĂ

Înainte de a importa fișierele de test, setează în **Profil Firmă**:
- **CUI firmă:** `RO99887766`
- **Denumire:** `FIRMA MEA SRL`
- **Platitor TVA:** Da (pentru a testa banner-ul TVA prag)

---

## FIȘIER 1 — `TEST_SAGA_clienti_facturi_complete.csv`
**Import:** FAB → Import SAGA / WinMentor (sau Import Smart Unificat)
**Tip auto-detectat:** Clienți (facturi de încasat)
**Detectare:** header `DENUMIRE;CUI;NR. FACTURA` → nicio coloana `furnizor` → tip `clienti`

### Ce testează:
| Scenariul | Facturi |
|---|---|
| Client cu multe facturi istorice 2024 + 2025 | TEHNO CONSTRUCT (10 fac) |
| Facturi încasate în luni diferite (trend KPI) | Q1-Q4 2024, Q1-Q2 2025 |
| Facturi **neîncasate scadenta depășita** → alertă Home | FC-2025-028 (01/06/2025) |
| Facturi **neîncasate scadenta iminenta ≤5 zile** → badge amber | FC-2025-041 (05/07/2025) |
| Client cu suma cumulata > 300K lei (2025) → banner TVA prag | EUROCOM TRADING |
| Client **dual** (apare si la furnizori) → warning dual entity | EUROCOM, SMART IT, FOOD, AGRO |
| Paginare: >20 facturi total | TEHNO 10 + celelalte |

### KPI-uri afectate după import:
- **Facturat 30 zile** — facturi emise în lunile mai-iunie 2025
- **Încasat 30 zile** — facturi cu `Incasat` și `data_plata` recenta
- **Scadențe depășite** — FC-2025-028, FC-2025-030 → alertă pe Home
- **Trend vs luna anterioară** — comparatie mai vs aprilie 2025
- **Cashflow Bars** (după FIX 1) — comparatie vizuala 2 luni

---

## FIȘIER 2 — `TEST_SAGA_furnizori_facturi_complete.csv`
**Import:** FAB → Import SAGA / WinMentor
**Tip auto-detectat:** Furnizori (facturi de plătit)
**Detectare:** header `FURNIZOR;CUI;...` → coloana `furnizor` → tip `furnizori`

### Ce testează:
| Scenariul | Furnizori |
|---|---|
| Furnizor cu plăți lunare recurente 2024-2025 | GLOBAL ENERGY (12 fac) |
| Facturi **neplatite scadenta depasita** → alertă roșie | F-GE-2025-005 (15/06) |
| Facturi cu scadenta azi ±1 zi | F-BEC-2025-005 (10/05/2025) |
| Furnizor dual (apare si la clienti) | EUROCOM, SMART IT, FOOD |
| KPI „Furnizori de plătit 30 zile" | Toate facturile Neplatit recente |
| Cashflow ieșiri în Home | facturi platite mai-iunie |

### KPI-uri afectate:
- **Furnizori de plătit** — suma facturilor Neplatit recente
- **Cashflow Net** = Incasat - Platit (recalculat)
- **Scadențe depășite furnizori** — F-GE, F-AP2, F-BEC → alertă

---

## FIȘIER 3 — `TEST_WinMentor_status_achitat_complet.csv`
**Import:** FAB → Import SAGA / WinMentor
**Tip auto-detectat:** Clienți (header `COD FISCAL;PARTENER;NR. DOC;...`)
**Scop:** Actualizare status → `Neincasat` → `Incasat` pentru facturi existente

### Ce testează:
| Scenariul | Facturi |
|---|---|
| Update status `DA` (WinMentor) → `Incasat` | FC-2025-001, FC-2025-003 |
| Deduplicare: factura cu același nr. → actualizare, nu duplicat | FC-2024-016 |
| Actualizare KPI imediat după import | Cashflow Net creste |
| Contor `actualizate` în toast success | 20 facturi actualizate |

### KPI-uri afectate:
- **Încasat 30 zile** — creste daca facturile actualizate sunt din 30 zile
- **Sold client** — scade la 0 dupa actualizare
- **Alerte scadente** — dispare din lista dupa marcare Incasat

---

## FIȘIER 4 — `TEST_SAGA_contributii_2024_2025_complete.csv`
**Import:** FAB → Import Smart Unificat (sau Import CSV din sectiunea Contribuții)
**Tip auto-detectat:** Contribuții
**Detectare:** header `tip;suma;luna;achitat` → coloana `tip` cu valori TVA/CAS/CASS

### Ce testează:
| Scenariul | Luni |
|---|---|
| Import 12 luni 2024 complet → toți achitatI | 2024-01 → 2024-12 |
| Import 4 luni 2025 achitate | 2025-01 → 2025-04 |
| Import 2 luni 2025 **neachitate** → alertă + badge | 2025-05, 2025-06 |
| Filtrare pe tip (TVA / CAS / CASS / Impozit) | Toate tipurile prezente |
| Filtrare pe status (Achitate / Neachitate) | Mix |
| KPI „Contribuții Buget Stat" pe Home + Financiar | Suma neachitate |
| Export CSV după import (buton nou) | Toate 90 rânduri |
| Suma anuala 2025 depaseste 80% din 395K | Total 2025 ≈ 86K → fara banner TVA |

### KPI-uri afectate:
- **Contribuții Buget Stat** (Home + Financiar) — suma neachitate mai+iunie
- **Scadențe contribuții** — 25 iunie și 25 iulie → alertă Home
- **Cashflow Net** (dacă include contrib.) — scade cu suma neachitate

---

## FIȘIER 5 — `TEST_XML_SAGA_facturi_emise_complete.xml`
**Import:** FAB → Import SAGA / WinMentor (sau Import Smart Unificat)
**Tip auto-detectat:** XML cu `FurnizorCIF=RO99887766` = CUI firmă → tip `clienti`
**Scop:** Testare completă `_importSmartXML()`

### Ce testează:
| Scenariul | Facturi |
|---|---|
| Detectare tip din CIF firmă = FurnizorCIF | Toate 16 facturi |
| Valori mari (> 100K) → calcul corect KPI | FC-XML-2025-001 (120K) |
| Client NOU (nu există în DB) → creare automată | NOVA TECH SYSTEMS (RO77665544) |
| Client dual (apare și furnizor) → warning | EUROCOM, SMART IT |
| Facturi 2024 și 2025 → trend comparativ | 2024-06 → 2025-06 |
| Status Incasat + Neincasat în același XML | Mix |
| Suma anuala mare (2025: > 310K) → banner TVA prag | EUROCOM 95K + 82K + restul |

### KPI-uri afectate:
- Toate KPI-urile Home se recalculează după import
- Banner „Atenție — prag TVA" poate apărea dacă suma 2025 > 316K (80% din 395K)
- Widget „Estimat luna viitoare" se actualizează cu noile scadențe

---

## FIȘIER 6 — `TEST_SmartBill_XML_facturi_primite.xml`
**Import:** FAB → Import SAGA / WinMentor
**Tip auto-detectat:** XML cu `ClientCIF=RO99887766` = CUI firmă → tip `furnizori`
**Scop:** Testare `_importSmartXML()` pentru facturi de la furnizori (primite)

### Ce testează:
| Scenariul | Facturi |
|---|---|
| Detectare tip din CIF firmă = ClientCIF | Toate 12 facturi |
| Furnizor NOU → creare automată | LOGISTIX SOLUTIONS (RO88776655) |
| Furnizor dual → warning | EUROCOM, SMART IT |
| Facturi scadente în trecut → alertă roșie | F-BEC-2025-005 (10/05) |
| Facturi scadente această luna → alertă amber | F-GE-2025-005, F-AP2-2025-005 |
| KPI „Furnizori de plătit" recalculat | Suma tuturor Neplatit |

---

## ORDINE RECOMANDATA DE IMPORT (scenariul complet)

```
1. TEST_SAGA_clienti_facturi_complete.csv       → ~75 facturi clienti
2. TEST_SAGA_furnizori_facturi_complete.csv      → ~80 facturi furnizori
3. TEST_WinMentor_status_achitat_complet.csv     → 20 actualizari status
4. TEST_SAGA_contributii_2024_2025_complete.csv  → 90 contributii 2024-2025
5. TEST_XML_SAGA_facturi_emise_complete.xml      → 16 facturi noi clienți
6. TEST_SmartBill_XML_facturi_primite.xml        → 12 facturi noi furnizori
```

**Rezultat final așteptat după toți pașii:**
- ~91 facturi clienți, ~92 furnizori + ~18 noi din XML
- 90 înregistrări contribuții (60 achitate + 30 neachitate mai-iunie 2025)
- KPI Home: sume reale, trend activ vs luna anterioară
- Widget Cashflow Bars (după FIX 1): 2 bare vizibile
- Alerte: TEHNO FC-2025-028 scadent, BIROU EXPERT scadent, 10 contribuții neachitate
- Banner TVA: dacă suma 2025 din Financiar > 316.000 lei

---

## NOTE TEHNICE

**Format date acceptate:**
- CSV SAGA: `DD/MM/YYYY` sau `DD.MM.YYYY` sau `YYYY-MM-DD`
- WinMentor: `DD.MM.YYYY`
- XML: `YYYY-MM-DD`

**Separator CSV acceptat:** `;` (punct și virgulă) — standard românesc

**Statuses acceptate (caz insensitive):**
- Clienți: `Incasat`, `incasat`, `DA`, `da`, `achitat`, `1`, `paid`
- Furnizori: `Platit`, `platit`, `DA`, `da`, `achitat`, `1`
- Neachitate (default): orice alt valoare sau câmp gol

**CUI format:** `RO12345678` sau `12345678` (prefixul `RO` opțional)
