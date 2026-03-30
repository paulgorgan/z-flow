-- ================================================================
-- Z-FLOW v8 — SETUP COMPLET SI IDEMPOTENT (fisier unic)
-- Contine: tabele, indecsi, triggere, RLS, storage,
--          admin_notifications, subscription_tokens, RPC-uri admin,
--          app_config (mod mentenanta)
-- INSTRUCTIUNI:
--   1. Deschide https://supabase.com/dashboard/project/exrypxknksgrtrwnbtrl
--   2. SQL Editor -> "New query"
--   3. Copiaza tot continutul si lipeste
--   4. Click "Run" (sau Ctrl+Enter)
--
-- Poate fi rulat oricand, de oricite ori — nu produce erori.
-- ================================================================


-- ================================================================
-- SECTIUNEA 1: TABELE (CREATE IF NOT EXISTS)
-- ================================================================

-- ── profiles ──────────────────────────────────────────────────────
-- Schema completa v2 (user_id, display_name, plan_type, subscription)
CREATE TABLE IF NOT EXISTS public.profiles (
    id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email                   TEXT,
    display_name            TEXT,
    cui                     TEXT,
    nume_firma              TEXT,
    adresa                  TEXT,
    oras                    TEXT,
    judet                   TEXT,
    reg_com                 TEXT,
    iban                    TEXT,
    banca                   TEXT,
    telefon                 TEXT,
    plan_type               TEXT DEFAULT 'standard',
    subscription_expires_at TIMESTAMPTZ,
    subscription_token      TEXT,
    onboarding_done         BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
-- Migrare idempotenta: adauga coloanele v2 daca lipsesc
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name            TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email                   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type               TEXT DEFAULT 'standard';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_token      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_done         BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platitor_tva            BOOLEAN DEFAULT FALSE; -- [v74.4] Plătitor de TVA
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cota_tva_default       INTEGER DEFAULT 21;    -- [v75.0] Cotă TVA implicită (21=standard, 11=redusă, 0=scutit)
-- Sincronizeaza user_id = id pentru randurile vechi
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

-- ── clienti ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clienti (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nume_firma       TEXT NOT NULL,
    cui              TEXT,
    adresa           TEXT,
    oras             TEXT,
    persoana_contact TEXT,
    telefon          TEXT,
    contact_email    TEXT,
    iban             TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── facturi (de incasat) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturi (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id     UUID REFERENCES public.clienti(id) ON DELETE SET NULL,
    numar_factura TEXT,
    data_emiterii TEXT,
    data_scadenta DATE,
    valoare       NUMERIC(12,2) DEFAULT 0,
    moneda        TEXT DEFAULT 'RON',
    status_plata  TEXT DEFAULT 'Neincasat',
    descriere     TEXT,
    pdf_url       TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── furnizori ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.furnizori (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cui              TEXT,
    nume_firma       TEXT,
    adresa           TEXT,
    oras             TEXT,
    persoana_contact TEXT,
    telefon          TEXT,
    contact_email    TEXT,
    iban             TEXT,
    note             TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── facturi_platit (de platit) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturi_platit (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    furnizor_id   UUID REFERENCES public.furnizori(id) ON DELETE SET NULL,
    numar_factura TEXT,
    data_emiterii TEXT,
    data_scadenta DATE,
    valoare       NUMERIC(12,2) DEFAULT 0,
    moneda        TEXT DEFAULT 'RON',
    status_plata  TEXT DEFAULT 'Neplatit',
    descriere     TEXT,
    pdf_url       TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── produse (depozit) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.produse (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sku            TEXT,
    nume           TEXT NOT NULL,
    um             TEXT DEFAULT 'buc',
    categorie      TEXT,
    pret_vanzare   NUMERIC(12,2) DEFAULT 0,
    pret_achizitie NUMERIC(12,2) DEFAULT 0,
    stoc_curent    NUMERIC(12,3) DEFAULT 0,
    stoc_minim     NUMERIC(12,3) DEFAULT 0,
    locatie        TEXT,
    observatii     TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── miscari_stoc ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.miscari_stoc (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    produs_id   UUID REFERENCES public.produse(id) ON DELETE SET NULL,
    tip         TEXT NOT NULL,  -- 'Intrare' | 'Iesire' | 'Ajustare'
    cantitate   NUMERIC(12,3) NOT NULL,
    pret_unitar NUMERIC(12,2) DEFAULT 0,
    referinta   TEXT,
    observatii  TEXT,
    data        DATE DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── receptii ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receptii (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    furnizor_id UUID REFERENCES public.furnizori(id) ON DELETE SET NULL,
    data        DATE DEFAULT CURRENT_DATE,
    total       NUMERIC(12,2) DEFAULT 0,
    observatii  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── livrari ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.livrari (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id  UUID REFERENCES public.clienti(id) ON DELETE SET NULL,
    data       DATE DEFAULT CURRENT_DATE,
    total      NUMERIC(12,2) DEFAULT 0,
    observatii TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── soferi ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.soferi (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nume       TEXT NOT NULL,
    telefon    TEXT,
    nr_permis  TEXT,
    cnp        TEXT,
    email      TEXT,
    observatii TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── vehicule ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehicule (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nr_inmatriculare TEXT NOT NULL,
    marca            TEXT,
    model            TEXT,
    tip              TEXT,
    an_fabricatie    INTEGER,
    observatii       TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── comenzi_transport ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comenzi_transport (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id       UUID REFERENCES public.clienti(id) ON DELETE SET NULL,
    sofer_id        UUID REFERENCES public.soferi(id) ON DELETE SET NULL,
    vehicul_id      UUID REFERENCES public.vehicule(id) ON DELETE SET NULL,
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
-- Migrare idempotenta: adauga coloanele v2 daca lipsesc
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS ruta_de      TEXT;
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS ruta_la      TEXT;
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS data_plecare DATE;
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS data_livrare DATE;
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS numar_km     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.comenzi_transport ADD COLUMN IF NOT EXISTS valoare      NUMERIC(12,2) DEFAULT 0;

-- ── admin_notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id         BIGSERIAL PRIMARY KEY,
    to_email   TEXT NOT NULL,
    message    TEXT NOT NULL CHECK (char_length(message) <= 500),
    from_admin BOOLEAN DEFAULT TRUE,
    read       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── subscription_tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token         TEXT NOT NULL UNIQUE,
    used          BOOLEAN NOT NULL DEFAULT FALSE,
    used_by       TEXT,
    used_at       TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    plan_type     TEXT    NOT NULL DEFAULT 'standard',
    duration_days INTEGER NOT NULL DEFAULT 365,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migrare idempotenta: adauga coloanele v2 daca lipsesc
ALTER TABLE public.subscription_tokens ADD COLUMN IF NOT EXISTS plan_type     TEXT    NOT NULL DEFAULT 'standard';
ALTER TABLE public.subscription_tokens ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE public.subscription_tokens ADD COLUMN IF NOT EXISTS notes         TEXT;

-- ── app_config (mod mentenanta) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.app_config (key, value, updated_at)
VALUES ('maintenance_mode', '{"active":false,"message":"Se efectueaza actualizari. Va rugam sa reveniti in cateva minute.","enabledAt":null}', NOW())
ON CONFLICT (key) DO NOTHING;


-- ================================================================
-- SECTIUNEA 2: INDECSI (performanta filtrare per user)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_clienti_user_id            ON public.clienti(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_user_id             ON public.facturi(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_client_id           ON public.facturi(client_id);
CREATE INDEX IF NOT EXISTS idx_furnizori_user_id           ON public.furnizori(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_platit_user_id      ON public.facturi_platit(user_id);
CREATE INDEX IF NOT EXISTS idx_facturi_platit_furnizor_id  ON public.facturi_platit(furnizor_id);
CREATE INDEX IF NOT EXISTS idx_produse_user_id             ON public.produse(user_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_user_id        ON public.miscari_stoc(user_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_produs_id      ON public.miscari_stoc(produs_id);
CREATE INDEX IF NOT EXISTS idx_miscari_stoc_data           ON public.miscari_stoc(data DESC);
CREATE INDEX IF NOT EXISTS idx_receptii_user_id            ON public.receptii(user_id);
CREATE INDEX IF NOT EXISTS idx_livrari_user_id             ON public.livrari(user_id);
CREATE INDEX IF NOT EXISTS idx_soferi_user_id              ON public.soferi(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicule_user_id            ON public.vehicule(user_id);
CREATE INDEX IF NOT EXISTS idx_comenzi_transport_user_id   ON public.comenzi_transport(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_email   ON public.admin_notifications(to_email);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON public.admin_notifications(created_at DESC);


-- ================================================================
-- SECTIUNEA 3: STORAGE BUCKET
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('facturi-pdf', 'facturi-pdf', true)
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- SECTIUNEA 4: FUNCTII SI TRIGGERE
-- ================================================================

-- ── handle_updated_at: actualizeaza updated_at la fiecare UPDATE ──
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── handle_new_user: creeaza profil automat la signup ─────────────
-- Versiunea completa v2: insereaza id, user_id, email, created_at, updated_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, user_id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.id, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ================================================================
-- SECTIUNEA 5: RPC-URI ADMIN
-- ================================================================

-- ── admin_get_user_by_email ───────────────────────────────────────
-- DROP necesar: functia veche returna 3 coloane (fara display_name)
-- Acum returneaza 4: id, email, display_name, created_at
DROP FUNCTION IF EXISTS public.admin_get_user_by_email(TEXT);

CREATE FUNCTION public.admin_get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id           UUID,
    email        TEXT,
    display_name TEXT,
    created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email::TEXT,
        COALESCE(p.display_name, u.raw_user_meta_data->>'full_name') AS display_name,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_by_email(TEXT) TO authenticated;

-- ── admin_get_all_users ───────────────────────────────────────────
-- DROP necesar daca functia exista cu tip de retur diferit
DROP FUNCTION IF EXISTS public.admin_get_all_users();

CREATE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
    user_id                 UUID,
    email                   TEXT,
    display_name            TEXT,
    plan_type               TEXT,
    subscription_expires_at TIMESTAMPTZ,
    zile_pana_la_expirare   INTEGER,
    nr_facturi              BIGINT,
    nr_clienti              BIGINT,
    nr_comenzi              BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id                                                                          AS user_id,
        u.email::TEXT                                                                 AS email,
        COALESCE(p.display_name, u.raw_user_meta_data->>'full_name', u.email::TEXT)  AS display_name,
        COALESCE(p.plan_type, 'standard')                                             AS plan_type,
        p.subscription_expires_at,
        CASE
            WHEN p.subscription_expires_at IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM (p.subscription_expires_at - NOW()))::INTEGER
        END                                                                           AS zile_pana_la_expirare,
        (SELECT COUNT(*) FROM public.facturi           f  WHERE f.user_id  = u.id)   AS nr_facturi,
        (SELECT COUNT(*) FROM public.clienti           c  WHERE c.user_id  = u.id)   AS nr_clienti,
        (SELECT COUNT(*) FROM public.comenzi_transport ct WHERE ct.user_id = u.id)   AS nr_comenzi
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

-- ── admin_extend_subscription ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_extend_subscription(
    p_email TEXT,
    p_days  INTEGER DEFAULT 365,
    p_plan  TEXT    DEFAULT 'standard'
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_id        UUID;
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry     TIMESTAMPTZ;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(TRIM(p_email))
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT subscription_expires_at INTO v_current_expiry
    FROM public.profiles WHERE id = v_user_id;

    -- Extinde de la MAX(acum, expirare curenta) — nu taie abonamentele active
    v_new_expiry := GREATEST(NOW(), COALESCE(v_current_expiry, NOW())) + (p_days || ' days')::INTERVAL;

    INSERT INTO public.profiles (id, user_id, plan_type, subscription_expires_at, updated_at)
    VALUES (v_user_id, v_user_id, p_plan, v_new_expiry, NOW())
    ON CONFLICT (id) DO UPDATE
        SET plan_type               = p_plan,
            subscription_expires_at = v_new_expiry,
            updated_at              = NOW();

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(TEXT, INTEGER, TEXT) TO authenticated;


-- ================================================================
-- SECTIUNEA 6: ROW LEVEL SECURITY
-- ================================================================

-- ── profiles ──────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_owner_all"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own"      ON public.profiles;
DROP POLICY IF EXISTS "users_read_own_profile"   ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "profiles_owner_all" ON public.profiles
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── clienti ───────────────────────────────────────────────────────
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clienti_owner_all"   ON public.clienti;
DROP POLICY IF EXISTS "clienti_select_own"  ON public.clienti;
DROP POLICY IF EXISTS "clienti_insert_own"  ON public.clienti;
DROP POLICY IF EXISTS "clienti_update_own"  ON public.clienti;
DROP POLICY IF EXISTS "clienti_delete_own"  ON public.clienti;
CREATE POLICY "clienti_owner_all" ON public.clienti
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── facturi ───────────────────────────────────────────────────────
ALTER TABLE public.facturi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturi_owner_all"   ON public.facturi;
DROP POLICY IF EXISTS "facturi_select_own"  ON public.facturi;
DROP POLICY IF EXISTS "facturi_insert_own"  ON public.facturi;
DROP POLICY IF EXISTS "facturi_update_own"  ON public.facturi;
DROP POLICY IF EXISTS "facturi_delete_own"  ON public.facturi;
CREATE POLICY "facturi_owner_all" ON public.facturi
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── furnizori ─────────────────────────────────────────────────────
ALTER TABLE public.furnizori ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "furnizori_owner_all"  ON public.furnizori;
DROP POLICY IF EXISTS "furnizori_select_own" ON public.furnizori;
DROP POLICY IF EXISTS "furnizori_insert_own" ON public.furnizori;
DROP POLICY IF EXISTS "furnizori_update_own" ON public.furnizori;
DROP POLICY IF EXISTS "furnizori_delete_own" ON public.furnizori;
CREATE POLICY "furnizori_owner_all" ON public.furnizori
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── facturi_platit ────────────────────────────────────────────────
ALTER TABLE public.facturi_platit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "facturi_platit_owner_all"  ON public.facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_select_own" ON public.facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_insert_own" ON public.facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_update_own" ON public.facturi_platit;
DROP POLICY IF EXISTS "facturi_platit_delete_own" ON public.facturi_platit;
CREATE POLICY "facturi_platit_owner_all" ON public.facturi_platit
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── produse ───────────────────────────────────────────────────────
ALTER TABLE public.produse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "produse_owner_all"  ON public.produse;
DROP POLICY IF EXISTS "produse_select_own" ON public.produse;
DROP POLICY IF EXISTS "produse_insert_own" ON public.produse;
DROP POLICY IF EXISTS "produse_update_own" ON public.produse;
DROP POLICY IF EXISTS "produse_delete_own" ON public.produse;
CREATE POLICY "produse_owner_all" ON public.produse
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── miscari_stoc ──────────────────────────────────────────────────
ALTER TABLE public.miscari_stoc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "miscari_stoc_owner_all"  ON public.miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_select_own" ON public.miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_insert_own" ON public.miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_update_own" ON public.miscari_stoc;
DROP POLICY IF EXISTS "miscari_stoc_delete_own" ON public.miscari_stoc;
CREATE POLICY "miscari_stoc_owner_all" ON public.miscari_stoc
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── receptii ──────────────────────────────────────────────────────
ALTER TABLE public.receptii ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receptii_owner_all"  ON public.receptii;
DROP POLICY IF EXISTS "receptii_select_own" ON public.receptii;
DROP POLICY IF EXISTS "receptii_insert_own" ON public.receptii;
DROP POLICY IF EXISTS "receptii_update_own" ON public.receptii;
DROP POLICY IF EXISTS "receptii_delete_own" ON public.receptii;
CREATE POLICY "receptii_owner_all" ON public.receptii
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── livrari ───────────────────────────────────────────────────────
ALTER TABLE public.livrari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "livrari_owner_all"  ON public.livrari;
DROP POLICY IF EXISTS "livrari_select_own" ON public.livrari;
DROP POLICY IF EXISTS "livrari_insert_own" ON public.livrari;
DROP POLICY IF EXISTS "livrari_update_own" ON public.livrari;
DROP POLICY IF EXISTS "livrari_delete_own" ON public.livrari;
CREATE POLICY "livrari_owner_all" ON public.livrari
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── soferi ────────────────────────────────────────────────────────
ALTER TABLE public.soferi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "soferi_owner_all"  ON public.soferi;
DROP POLICY IF EXISTS "soferi_select_own" ON public.soferi;
DROP POLICY IF EXISTS "soferi_insert_own" ON public.soferi;
DROP POLICY IF EXISTS "soferi_update_own" ON public.soferi;
DROP POLICY IF EXISTS "soferi_delete_own" ON public.soferi;
CREATE POLICY "soferi_owner_all" ON public.soferi
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── vehicule ──────────────────────────────────────────────────────
ALTER TABLE public.vehicule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicule_owner_all"  ON public.vehicule;
DROP POLICY IF EXISTS "vehicule_select_own" ON public.vehicule;
DROP POLICY IF EXISTS "vehicule_insert_own" ON public.vehicule;
DROP POLICY IF EXISTS "vehicule_update_own" ON public.vehicule;
DROP POLICY IF EXISTS "vehicule_delete_own" ON public.vehicule;
CREATE POLICY "vehicule_owner_all" ON public.vehicule
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── comenzi_transport ─────────────────────────────────────────────
ALTER TABLE public.comenzi_transport ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comenzi_transport_owner_all"  ON public.comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_select_own" ON public.comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_insert_own" ON public.comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_update_own" ON public.comenzi_transport;
DROP POLICY IF EXISTS "comenzi_transport_delete_own" ON public.comenzi_transport;
CREATE POLICY "comenzi_transport_owner_all" ON public.comenzi_transport
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── admin_notifications ───────────────────────────────────────────
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own_notifications"      ON public.admin_notifications;
DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON public.admin_notifications;
CREATE POLICY "users_read_own_notifications" ON public.admin_notifications
    FOR SELECT USING (to_email = (auth.jwt() ->> 'email'));
CREATE POLICY "authenticated_insert_notifications" ON public.admin_notifications
    FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ── subscription_tokens ───────────────────────────────────────────
-- SELECT fara restrictie: validarea tokenului se face INAINTE de signUp
-- (utilizatorul nu are inca sesiune autentificata la momentul validarii)
ALTER TABLE public.subscription_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tokens_select_authenticated" ON public.subscription_tokens;
DROP POLICY IF EXISTS "tokens_select_anon"          ON public.subscription_tokens;
DROP POLICY IF EXISTS "tokens_select_all"           ON public.subscription_tokens;
DROP POLICY IF EXISTS "tokens_update_authenticated" ON public.subscription_tokens;
DROP POLICY IF EXISTS "tokens_insert_authenticated" ON public.subscription_tokens;
CREATE POLICY "tokens_select_all" ON public.subscription_tokens
    FOR SELECT USING (true);
CREATE POLICY "tokens_update_authenticated" ON public.subscription_tokens
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tokens_insert_authenticated" ON public.subscription_tokens
    FOR INSERT TO authenticated WITH CHECK (true);

-- ── app_config ────────────────────────────────────────────────────
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config: public read" ON public.app_config;
DROP POLICY IF EXISTS "app_config: auth write"  ON public.app_config;
CREATE POLICY "app_config: public read" ON public.app_config
    FOR SELECT USING (true);
CREATE POLICY "app_config: auth write" ON public.app_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── storage: facturi-pdf ──────────────────────────────────────────
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
    FOR INSERT WITH CHECK (bucket_id = 'facturi-pdf' AND auth.role() = 'authenticated');
CREATE POLICY "storage_facturi_owner_delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'facturi-pdf' AND auth.uid() = owner);


-- ================================================================
-- SECTIUNEA 7: VERIFICARE FINALA
-- ================================================================
SELECT tabel, randuri, politici_rls
FROM (
    SELECT 'profiles'             AS tabel,
           COUNT(*)::BIGINT       AS randuri,
           (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'profiles')::BIGINT AS politici_rls
    FROM public.profiles
    UNION ALL
    SELECT 'subscription_tokens',
           COUNT(*),
           (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'subscription_tokens')
    FROM public.subscription_tokens
    UNION ALL
    SELECT 'admin_notifications',
           COUNT(*),
           (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'admin_notifications')
    FROM public.admin_notifications
    UNION ALL
    SELECT 'app_config',
           COUNT(*),
           (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'app_config')
    FROM public.app_config
) q
ORDER BY tabel;

-- ================================================================
-- DONE — toate tabelele, triggere, RPC-urile si politicile RLS
--        au fost create/actualizate cu succes.
-- ================================================================
