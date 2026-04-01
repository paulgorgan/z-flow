# README — Test Data 3 (test-data3)

Dosarul conține fișiere de test pentru importul SAGA / WinMentor / SmartBill XML în Z-FLOW.  
Acoperă perioada **2024 – 2026** cu clienți, furnizori, contribuții și cazuri limită.

---

## CUI firmă de test

Înainte de orice import, verifică că `Profil Firmă → CUI` este setat la **RO99887766**.  
Acesta este CUI-ul firmei noastre folosit în fișierele XML pentru detecția direcției facturii.

---

## Ordine recomandată de import

### 1. Date inițiale 2024

| Fișier | Tip | Destinație | Rânduri |
|--------|-----|-----------|---------|
| `TEST_SAGA_clienti_2024_anual.csv` | SAGA CSV | Clienți → Facturi | 63 |
| `TEST_SAGA_furnizori_2024_anual.csv` | SAGA CSV | Furnizori → Facturi | 79 |
| `TEST_SAGA_contributii_2024_anual.csv` | Contribuții CSV | Contribuții Buget | 60 |

### 2. Date inițiale 2025 H1

| Fișier | Tip | Destinație | Rânduri |
|--------|-----|-----------|---------|
| `TEST_SAGA_clienti_2025_H1.csv` | SAGA CSV | Clienți → Facturi | 71 |
| `TEST_SAGA_furnizori_2025_H1.csv` | SAGA CSV | Furnizori → Facturi | 43 |
| `TEST_SAGA_contributii_2025_H1.csv` | Contribuții CSV | Contribuții Buget | 30 |

### 3. Import WinMentor (format alternativ)

| Fișier | Tip | Destinație | Rânduri |
|--------|-----|-----------|---------|
| `TEST_WinMentor_clienti_2024_2025.csv` | WinMentor CSV | Clienți | 47 |
| `TEST_WinMentor_furnizori_2024_2025.csv` | WinMentor CSV | Furnizori | 48 |

### 4. Import XML SmartBill / Z-Flow

| Fișier | Tip | Destinație | Facturi |
|--------|-----|-----------|---------|
| `TEST_SmartBill_emise_clienti.xml` | XML ZFlow/SmartBill | Clienți (FurnizorCIF = RO99887766) | 17 |
| `TEST_SmartBill_primite_furnizori.xml` | XML ZFlow/SmartBill | Furnizori (ClientCIF = RO99887766) | 17 |

### 5. Import XML SAGA nativ

| Fișier | Tip | Destinație | Facturi |
|--------|-----|-----------|---------|
| `TEST_XML_SAGA_nativ_emise.xml` | XML SAGA `<jurnal>` | Clienți (FurnizorCIF = RO99887766) | 14 |

### 6. UPDATE — marcarea ca plătite

| Fișier | Tip | Efect |
|--------|-----|-------|
| `UPDATE_SAGA_clienti_incasate_batch.csv` | SAGA CSV UPDATE | Marchează 27 facturi client ca **Incasat** |
| `UPDATE_SAGA_furnizori_platite_batch.csv` | SAGA CSV UPDATE | Marchează 16 facturi furnizor ca **Platit** |
| `UPDATE_WinMentor_clienti_incasat.csv` | WinMentor UPDATE | Marchează 10 facturi WinMentor ca **Incasat** |
| `UPDATE_SAGA_contributii_achitate.csv` | Contribuții UPDATE | Marchează 28 contribuții ca **achitat=da** |

### 7. Cazuri limită

| Fișier | Tip | Testează |
|--------|-----|---------|
| `TEST_SAGA_edge_cases.csv` | SAGA CSV special | Scadențe azi/mâine, sume extreme, date cross-year, facturi vechi 2023 |

---

## Ce funcții sunt testate

| Funcție aplicație | Fișier(e) care o testează |
|------------------|---------------------------|
| Import SAGA CSV clienți | `TEST_SAGA_clienti_*.csv` |
| Import SAGA CSV furnizori | `TEST_SAGA_furnizori_*.csv` |
| Import contribuții buget | `TEST_SAGA_contributii_*.csv` |
| Import WinMentor (auto-detecție header) | `TEST_WinMentor_*.csv` |
| Import XML format Z-Flow/SmartBill (emis) | `TEST_SmartBill_emise_clienti.xml` |
| Import XML format Z-Flow/SmartBill (primit) | `TEST_SmartBill_primite_furnizori.xml` |
| Import XML format SAGA nativ `<jurnal>` | `TEST_XML_SAGA_nativ_emise.xml` |
| UPDATE status plată (CSV re-import) | `UPDATE_SAGA_*.csv`, `UPDATE_WinMentor_*.csv` |
| Badge client+furnizor simultan | Firme RO12345678, RO34567890, RO23456789, RO67890123, RO56789012 |
| KPI 30 zile / 90 zile overdue | `TEST_SAGA_edge_cases.csv` (`EDGE-003`, `EDGE-004`) |
| Calcul cashflow lunar (Analytics) | Toate fișierele 2024-2026 |
| Alertă scadență azi | `EDGE-001`, `EDGE-012` (DATA SCADENTA = 01.04.2026) |
| Alertă scadență mâine | `EDGE-002` (DATA SCADENTA = 02.04.2026) |
| Sume extreme (Analytics) | `EDGE-005`, `EDGE-007` (850k, 1.5M RON) |
| Facturi istorice (2023) | `EDGE-017` |
| Facturi viitoare (2026) | `EDGE-011`, `EDGE-016` |

---

## Firme de test (dual client+furnizor)

Firmele de mai jos apar ca **și client ȘI furnizor** — testează badge-ul special din UI:

| CUI | Denumire | Roluri |
|-----|----------|--------|
| RO12345678 | TEHNO CONSTRUCT SRL | Client + Furnizor |
| RO34567890 | METAL GRUP SRL | Client + Furnizor |
| RO23456789 | AGRO PRODUSE SA | Client + Furnizor |
| RO67890123 | EUROCOM TRADING SRL | Client + Furnizor |
| RO56789012 | SMART IT SOLUTIONS SRL | Client + Furnizor |

---

## Verificare după import

1. **Clienți tab**: minim 14 firme distincte vizibile după import complet
2. **Furnizori tab**: minim 13 firme distincte
3. **Contribuții tab**: minim 12 luni 2024 + 6 luni 2025 = 18 perioade
4. **Analytics KPI**: suma neîncasată să includă facturile cu scadența trecută
5. **Cashflow chart**: bare vizibile pentru fiecare lună 2024 și 2025
6. **Badge dual**: firmele din tabelul de mai sus să afișeze badge distinct
7. **Alerte scadență**: `EDGE-001` și `EDGE-012` să apară în lista roșie azi (01.04.2026)

---

## Instrucțiuni import XML

1. Du-te la **Import → XML**
2. Selectează fișierul XML
3. Aplicația detectează automat dacă sunt facturi emise sau primite  
   bazat pe compararea `FurnizorCIF` / `ClientCIF` cu CUI-ul din Profil Firmă
4. Confirmă importul și verifică mesajul de succes

---

*Generat automat — Z-FLOW test-data3 — Aprilie 2026*
