-- ================================================================
-- Z-FLOW v8 — SETUP COMPLET ȘI IDEMPOTENT
-- Conține: tabele, indecși, trigger profil, RLS, storage
-- Rulează în Supabase SQL Editor oricând, fără erori.
-- ================================================================


-- ================================================================
-- 1. TABELE (CREATE IF NOT EXISTS)
-- ================================================================

-- Profil firmă (1 per user, id = auth.uid())
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cui           TEXT,
  nume_firma    TEXT,
  adresa        TEXT,
  oras          TEXT,
  judet         TEXT,
  reg_com       TEXT,
  iban          TEXT,
  banca         TEXT,
  telefon       TEXT,
  email         TEXT,
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Clienți
CREATE TABLE IF NOT EXISTS clienti (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nume_firma        TEXT NOT NULL,
  cui               TEXT,
  adresa            TEXT,
  oras              TEXT,
  persoana_contact  TEXT,
  telefon           TEXT,
  contact_email     TEXT,
  iban              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Facturi de încasat (clienți)
CREATE TABLE IF NOT EXISTS facturi (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clienti(id) ON DELETE SET NULL,
  numar_factura   TEXT,
  data_emiterii   TEXT,
  data_scadenta   DATE,
  valoare         NUMERIC(12,2) DEFAULT 0,
  moneda          TEXT DEFAULT 'RON',
  status_plata    TEXT DEFAULT 'Neincasat',
  descriere       TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Furnizori
CREATE TABLE IF NOT EXISTS furnizori (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cui               TEXT,
  nume_firma        TEXT,
  adresa            TEXT,
  oras              TEXT,
  persoana_contact  TEXT,
  telefon           TEXT,
  contact_email     TEXT,
  iban              TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Facturi de plătit (furnizori)
CREATE TABLE IF NOT EXISTS facturi_platit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  furnizor_id     UUID REFERENCES furnizori(id) ON DELETE SET NULL,
  numar_factura   TEXT,
  data_emiterii   TEXT,
  data_scadenta   DATE,
  valoare         NUMERIC(12,2) DEFAULT 0,
  moneda          TEXT DEFAULT 'RON',
  status_plata    TEXT DEFAULT 'Neplatit',
  descriere       TEXT,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Produse depozit
CREATE TABLE IF NOT EXISTS produse (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sku             TEXT,
  nume            TEXT NOT NULL,
  um              TEXT DEFAULT 'buc',
  categorie       TEXT,
  pret_vanzare    NUMERIC(12,2) DEFAULT 0,
  pret_achizitie  NUMERIC(12,2) DEFAULT 0,
  stoc_curent     NUMERIC(12,3) DEFAULT 0,
  stoc_minim      NUMERIC(12,3) DEFAULT 0,
  locatie         TEXT,
  observatii      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mișcări stoc
CREATE TABLE IF NOT EXISTS miscari_stoc (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  produs_id   UUID REFERENCES produse(id) ON DELETE SET NULL,
  tip         TEXT NOT NULL,       -- 'Intrare' | 'Iesire' | 'Ajustare'
  cantitate   NUMERIC(12,3) NOT NULL,
  pret_unitar NUMERIC(12,2) DEFAULT 0,
  referinta   TEXT,
  observatii  TEXT,
  data        DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Recepții depozit
CREATE TABLE IF NOT EXISTS receptii (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  furnizor_id UUID REFERENCES furnizori(id) ON DELETE SET NULL,
  data        DATE DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2) DEFAULT 0,
  observatii  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Livrări depozit
CREATE TABLE IF NOT EXISTS livrari (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID REFERENCES clienti(id) ON DELETE SET NULL,
  data        DATE DEFAULT CURRENT_DATE,
  total       NUMERIC(12,2) DEFAULT 0,
  observatii  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Șoferi
CREATE TABLE IF NOT EXISTS soferi (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nume        TEXT NOT NULL,
  telefon     TEXT,
  nr_permis   TEXT,
  cnp         TEXT,
  email       TEXT,
  observatii  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicule
CREATE TABLE IF NOT EXISTS vehicule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nr_inmatriculare    TEXT NOT NULL,
  marca               TEXT,
  model               TEXT,
  tip                 TEXT,
  an_fabricatie       INTEGER,
  observatii          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Comenzi transport
CREATE TABLE IF NOT EXISTS comenzi_transport (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clienti(id) ON DELETE SET NULL,
  sofer_id        UUID REFERENCES soferi(id) ON DELETE SET NULL,
  vehicul_id      UUID REFERENCES vehicule(id) ON DELETE SET NULL,
  tracking_code   TEXT,
  status          TEXT DEFAULT 'Nou',
  data_ridicare   DATE,
  adresa_ridicare TEXT,
  adresa_livrare  TEXT,
  ruta_de         TEXT,
  ruta_la         TEXT,
  data_plecare    DATE,
  data_livrare    DATE,
  numar_km        NUMERIC(10,2) DEFAULT 0,
  valoare         NUMERIC(12,2) DEFAULT 0,
  observatii      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Migrare: adaugă coloanele lipsă dacă tabela există deja
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS ruta_de      TEXT;
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS ruta_la      TEXT;
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS data_plecare DATE;
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS data_livrare DATE;
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS numar_km     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE comenzi_transport ADD COLUMN IF NOT EXISTS valoare      NUMERIC(12,2) DEFAULT 0;


-- ================================================================
-- 2. INDECȘI (performanță filtrare per user)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_clienti_user_id           ON clienti(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_user_id            ON facturi(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_client_id          ON facturi(client_id);
CREATE INDEX IF NOT EXISTS idx_furnizori_user_id          ON furnizori(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_platit_user_id     ON facturi_platit(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_platit_furnizor_id ON facturi_platit(furnizor_id);
CREATE INDEX IF NOT EXISTS idx_produse_user_id            ON produse(user_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_user_id       ON miscari_stoc(user_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_produs_id     ON miscari_stoc(produs_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_data          ON miscari_stoc(data DESC);
CREATE INDEX IF NOT EXISTS idx_receptii_user_id           ON receptii(user_id);
CREATE INDEX IF NOT EXISTS idx_livrari_user_id            ON livrari(user_id);
CREATE INDEX IF NOT EXISTS idx_soferi_user_id             ON soferi(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicule_user_id           ON vehicule(user_id);
CREATE INDEX IF NOT EXISTS idx_comenzi_transport_user_id  ON comenzi_transport(user_id);


-- ================================================================
-- 3. TRIGGER — creare profil automat la signup
-- ================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, updated_at)
  VALUES (NEW.id, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- 4. STORAGE BUCKET — facturi-pdf
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('facturi-pdf', 'facturi-pdf', true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- 5. RLS — activare + politici (DROP IF EXISTS + CREATE)
-- ================================================================

-- ── PROFILES ──────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_owner_all"           ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"          ON profiles;
CREATE POLICY "profiles_owner_all" ON profiles
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── CLIENTI ───────────────────────────────────────────────────
ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clienti_owner_all"            ON clienti;
DROP POLICY IF EXISTS "clienti_select_own"           ON clienti;
DROP POLICY IF EXISTS "clienti_insert_own"           ON clienti;
DROP POLICY IF EXISTS "clienti_update_own"           ON clienti;
DROP POLICY IF EXISTS "clienti_delete_own"           ON clienti;
CREATE POLICY "clienti_owner_all" ON clienti
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── FACTURI ───────────────────────────────────────────────────
ALTER TABLE facturi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturi_owner_all"            ON facturi;
DROP POLICY IF EXISTS "facturi_select_own"           ON facturi;
DROP POLICY IF EXISTS "facturi_insert_own"           ON facturi;
DROP POLICY IF EXISTS "facturi_update_own"           ON facturi;
DROP POLICY IF EXISTS "facturi_delete_own"           ON facturi;
CREATE POLICY "facturi_owner_all" ON facturi
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── FURNIZORI ─────────────────────────────────────────────────
ALTER TABLE furnizori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "furnizori_owner_all"          ON furnizori;
DROP POLICY IF EXISTS "furnizori_select_own"         ON furnizori;
DROP POLICY IF EXISTS "furnizori_insert_own"         ON furnizori;
DROP POLICY IF EXISTS "furnizori_update_own"         ON furnizori;
DROP POLICY IF EXISTS "furnizori_delete_own"         ON furnizori;
CREATE POLICY "furnizori_owner_all" ON furnizori
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── FACTURI_PLATIT ────────────────────────────────────────────
ALTER TABLE facturi_platit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturi_platit_owner_all"     ON facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_select_own"    ON facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_insert_own"    ON facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_update_own"    ON facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_delete_own"    ON facturi_platit;
CREATE POLICY "facturi_platit_owner_all" ON facturi_platit
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── PRODUSE ───────────────────────────────────────────────────
ALTER TABLE produse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produse_owner_all"            ON produse;
DROP POLICY IF EXISTS "produse_select_own"           ON produse;
DROP POLICY IF EXISTS "produse_insert_own"           ON produse;
DROP POLICY IF EXISTS "produse_update_own"           ON produse;
DROP POLICY IF EXISTS "produse_delete_own"           ON produse;
CREATE POLICY "produse_owner_all" ON produse
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── MISCARI_STOC ──────────────────────────────────────────────
ALTER TABLE miscari_stoc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "miscari_stoc_owner_all"       ON miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_select_own"      ON miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_insert_own"      ON miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_update_own"      ON miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_delete_own"      ON miscari_stoc;
CREATE POLICY "miscari_stoc_owner_all" ON miscari_stoc
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── RECEPTII ──────────────────────────────────────────────────
ALTER TABLE receptii ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receptii_owner_all"           ON receptii;
DROP POLICY IF EXISTS "receptii_select_own"          ON receptii;
DROP POLICY IF EXISTS "receptii_insert_own"          ON receptii;
DROP POLICY IF EXISTS "receptii_update_own"          ON receptii;
DROP POLICY IF EXISTS "receptii_delete_own"          ON receptii;
CREATE POLICY "receptii_owner_all" ON receptii
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── LIVRARI ───────────────────────────────────────────────────
ALTER TABLE livrari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "livrari_owner_all"            ON livrari;
DROP POLICY IF EXISTS "livrari_select_own"           ON livrari;
DROP POLICY IF EXISTS "livrari_insert_own"           ON livrari;
DROP POLICY IF EXISTS "livrari_update_own"           ON livrari;
DROP POLICY IF EXISTS "livrari_delete_own"           ON livrari;
CREATE POLICY "livrari_owner_all" ON livrari
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── SOFERI ────────────────────────────────────────────────────
ALTER TABLE soferi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soferi_owner_all"             ON soferi;
DROP POLICY IF EXISTS "soferi_select_own"            ON soferi;
DROP POLICY IF EXISTS "soferi_insert_own"            ON soferi;
DROP POLICY IF EXISTS "soferi_update_own"            ON soferi;
DROP POLICY IF EXISTS "soferi_delete_own"            ON soferi;
CREATE POLICY "soferi_owner_all" ON soferi
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── VEHICULE ──────────────────────────────────────────────────
ALTER TABLE vehicule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicule_owner_all"           ON vehicule;
DROP POLICY IF EXISTS "vehicule_select_own"          ON vehicule;
DROP POLICY IF EXISTS "vehicule_insert_own"          ON vehicule;
DROP POLICY IF EXISTS "vehicule_update_own"          ON vehicule;
DROP POLICY IF EXISTS "vehicule_delete_own"          ON vehicule;
CREATE POLICY "vehicule_owner_all" ON vehicule
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── COMENZI_TRANSPORT ─────────────────────────────────────────
ALTER TABLE comenzi_transport ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comenzi_transport_owner_all"  ON comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_select_own" ON comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_insert_own" ON comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_update_own" ON comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_delete_own" ON comenzi_transport;
CREATE POLICY "comenzi_transport_owner_all" ON comenzi_transport
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── STORAGE: facturi-pdf ──────────────────────────────────────
DROP POLICY IF EXISTS "storage_facturi_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_auth_insert"  ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_owner_all"    ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_select"       ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_insert"       ON storage.objects;
DROP POLICY IF EXISTS "storage_facturi_delete"       ON storage.objects;

CREATE POLICY "storage_facturi_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'facturi-pdf');

CREATE POLICY "storage_facturi_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'facturi-pdf' AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage_facturi_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'facturi-pdf' AND auth.uid() = owner
  );


-- ================================================================
-- DONE — rulează cu succes indiferent de starea anterioară
-- ================================================================
