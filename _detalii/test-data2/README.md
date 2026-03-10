# Z-FLOW Test Data v2 — Date de Test pentru Testare Completă

Acest folder conține fișiere CSV noi pentru testarea tuturor funcționalităților aplicației Z-FLOW.
Datele sunt fictive și nu au legătură cu persoane sau entități reale.

---

## 📁 Conținut Fișiere

### 1. `clienti_facturi.csv`
**Modul:** Financiar → Import Facturi SAGA (Clienți)

| Coloană | Descriere |
|---------|-----------|
| CUI | Codul unic de identificare firmă |
| DENUMIRE | Denumirea companiei client |
| ADRESA | Adresa sediu social |
| LOCALITATE | Orașul |
| JUDET | Județul |
| NR. FACTURA | Numărul facturii |
| DATA EMITERE | Data emiterii (DD.MM.YYYY) |
| DATA SCADENTA | Data scadenței (DD.MM.YYYY) |
| VALOARE | Valoarea în RON |
| STATUS | `Incasat` sau `Neincasat` |
| DESCRIERE | Descrierea serviciului/produsului |

**Clienți incluși:** Nova Construct, Aura Digital, Helio Energy, Prodeco Food, Vega Retail  
**Facturi:** 15 total — mix de Incasat (7) și Neincasat (8)

---

### 2. `furnizori_facturi.csv`
**Modul:** Financiar → Import Facturi SAGA (Furnizori)

Același format ca `clienti_facturi.csv`, cu STATUS `Platit`/`Neplatit`.

**Furnizori incluși:** MetalPrim, UniTrans, LuminaTech, PackSmart, CloudHost  
**Facturi:** 12 total — mix de Platit (5) și Neplatit (7)

---

### 3. `comenzi_transport.csv`
**Modul:** Logistic → Import Comenzi Transport

| Coloană | Descriere |
|---------|-----------|
| tracking_code | Cod unic comandă (ex: TRK-2025-001) |
| ruta_de | Orașul de plecare |
| ruta_la | Orașul de destinație |
| data_plecare | Data plecării (DD.MM.YYYY) |
| data_livrare | Data livrării estimate (DD.MM.YYYY) |
| status | `Livrat`, `In tranzit`, `Planificat` |
| valoare | Valoarea transportului (RON) |
| observatii | Note suplimentare |

**Comenzi:** 12 — rute naționale, statusuri mixte

---

### 4. `produse.csv`
**Modul:** Depozit → Import Produse

| Coloană | Descriere |
|---------|-----------|
| sku | Codul produsului |
| nume | Denumirea produsului |
| um | Unitatea de măsură (buc, rola, top, set) |
| categorie | Categoria produsului |
| pret_achizitie | Prețul de achiziție (RON) |
| pret_vanzare | Prețul de vânzare (RON) |
| stoc_minim | Stocul minim de alertă |
| stoc_initial | Cantitatea inițiala în stoc |
| observatii | Observații sau specificații |

**Produse:** 20 — categorie IT & Electronice, Periferice, Consumabile, Rețea

---

### 5. `vehicule.csv`
**Modul:** Logistic → Import Vehicule

| Coloană | Descriere |
|---------|-----------|
| nr_inmatriculare | Numărul de înmatriculare (ex: B-12-XYZ) |
| marca | Marca vehiculului |
| model | Modelul vehiculului |
| tip | Tipul: `Camion`, `Furgoneta` |
| an_fabricatie | Anul fabricației |
| observatii | Specificații, certificări |

**Vehicule:** 8 — mix camioane TIR și furgonete

---

### 6. `soferi.csv`
**Modul:** Logistic → Import Șoferi

| Coloană | Descriere |
|---------|-----------|
| nume | Numele complet al șoferului |
| telefon | Numărul de telefon |
| nr_permis | Numărul permisului de conducere |
| cnp | CNP-ul șoferului |
| email | Adresa de email |
| observatii | Categorii permis, experiență |

**Șoferi:** 6 — permise B, C, C+E, ADR

---

## 🚀 Instrucțiuni de Utilizare

### Import Facturi SAGA (Clienți + Furnizori)
1. **Acțiuni** → **Import Facturi SAGA**
2. Selectați `clienti_facturi.csv` — aplicația detectează automat tipul **Clienți**
3. Confirmați importul
4. Repetați pentru `furnizori_facturi.csv` — detectează **Furnizori**

### Import Produse Depozit
1. **Depozit** → butonul **Import Produse CSV**
2. Selectați `produse.csv`

### Import Logistic
1. **Logistic** → **Vehicule** → Import Vehicule → selectați `vehicule.csv`
2. **Logistic** → **Șoferi** → Import Șoferi → selectați `soferi.csv`
3. **Logistic** → **Comenzi** → Import Comenzi → selectați `comenzi_transport.csv`

---

## ⚠️ Note
- Toate datele sunt fictive (CUI-uri, CNP-uri, adrese)
- Asigurați-vă că aveți permisiunile `canImport` activate
- În modul **Admin/Demo**, datele se salvează local (localStorage)
- În modul **Supabase**, datele se trimit în baza de date

---

*Z-FLOW Test Data v2 — generat pentru testare 2025*
