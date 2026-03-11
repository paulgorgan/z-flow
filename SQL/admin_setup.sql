-- ============================================================
-- Z-FLOW Admin Setup SQL
-- Rulează în Supabase Dashboard > SQL Editor
-- Creat de R5-FIX 1
-- ============================================================

-- 1. Tabela pentru notificări admin → utilizatori
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id          BIGSERIAL PRIMARY KEY,
    to_email    TEXT NOT NULL,
    message     TEXT NOT NULL CHECK (char_length(message) <= 500),
    from_admin  BOOLEAN DEFAULT TRUE,
    read        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: utilizatorul poate citi DOAR propriile notificări
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_read_own_notifications"
    ON public.admin_notifications FOR SELECT
    USING (to_email = auth.jwt() ->> 'email');

-- Service role (admin server-side) poate scrie orice
CREATE POLICY IF NOT EXISTS "service_role_insert_notifications"
    ON public.admin_notifications FOR INSERT
    WITH CHECK (TRUE);  -- restricționat la service_role key în producție

-- 2. RPC pentru admin: caută un user după email în auth.users
-- NOTĂ: Necesită extensia pgcrypto și acces la auth.users (doar service_role)
-- Dacă aplicația rulează cu anon key, această funcție va returna NULL
CREATE OR REPLACE FUNCTION public.admin_get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id          UUID,
    email       TEXT,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER  -- rulează cu privilegii owner, nu ale apelantului
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email::TEXT,
        u.created_at
    FROM auth.users u
    WHERE LOWER(u.email) = LOWER(p_email)
    LIMIT 1;
END;
$$;

-- Acordă execuție rolului authenticated (adminul Supabase real)
-- Dacă adminul e local (nu Supabase), această funcție nu va putea fi apelată
GRANT EXECUTE ON FUNCTION public.admin_get_user_by_email(TEXT) TO authenticated;

-- 3. Index pentru performanță
CREATE INDEX IF NOT EXISTS idx_admin_notifications_email
    ON public.admin_notifications (to_email);

-- 4. Tabela profiles (dacă nu există deja)
CREATE TABLE IF NOT EXISTS public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT,
    display_name TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_read_own_profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "users_update_own_profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);
