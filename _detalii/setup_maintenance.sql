-- =======================================================
-- Z-FLOW: Setup tabel app_config pentru Mod Mentenanță
-- Rulați o singură dată în Supabase Dashboard > SQL Editor
-- =======================================================

-- 1. Creează tabelul de configurare globală
CREATE TABLE IF NOT EXISTS public.app_config (
    key         text PRIMARY KEY,
    value       text NOT NULL DEFAULT '{}',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Activează Row Level Security
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 3. Permite ORICUI (inclusiv vizitatori neautentificați) să CITEASCĂ configurația
CREATE POLICY "app_config: public read"
    ON public.app_config
    FOR SELECT
    USING (true);

-- 4. Permite DOAR utilizatorilor autentificați (admin) să SCRIE în configurație
--    (în producție puteți restricționa la un anumit user_id sau email)
CREATE POLICY "app_config: auth write"
    ON public.app_config
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Inserează valoarea implicită (mentenanță dezactivată)
INSERT INTO public.app_config (key, value, updated_at)
VALUES ('maintenance_mode', '{"active":false,"message":"Se efectueaz\u0103 actualiz\u0103ri. V\u0103 rug\u0103m s\u0103 reveni\u021bi \u00een c\u00e2teva minute.","enabledAt":null}', now())
ON CONFLICT (key) DO NOTHING;

-- =======================================================
-- VERIFICARE (opțional):
-- SELECT * FROM app_config;
-- =======================================================
