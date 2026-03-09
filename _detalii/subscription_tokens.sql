-- ================================================================
-- Z-FLOW: Tabel subscription_tokens pentru autentificare abonament
-- Rulează în Supabase SQL Editor (sau cu psql ca service role)
-- ================================================================

CREATE TABLE IF NOT EXISTS subscription_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  used_by    TEXT,
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: permite oricui autentificat să citească (pentru validare)
ALTER TABLE subscription_tokens ENABLE ROW LEVEL SECURITY;

-- Orice utilizator autentificat poate verifica dacă un token e valid (SELECT)
CREATE POLICY "tokens_select_authenticated" ON subscription_tokens
  FOR SELECT
  TO authenticated
  USING (true);

-- Orice utilizator autentificat poate marca token-ul ca utilizat (UPDATE pe used/used_by/used_at)
-- Restricția reală se aplică prin logica din aplicație (consumeSubscriptionToken)
CREATE POLICY "tokens_update_authenticated" ON subscription_tokens
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- INSERT și DELETE sunt rezervate service role (admin-ul adaugă tokene manual sau prin API)
-- Nu adăugăm policy pentru INSERT/DELETE → blocate implicit pentru utilizatorii normali

-- ================================================================
-- EXEMPLU: Inserare token de test (rulează manual ca service role)
-- ================================================================
-- INSERT INTO subscription_tokens (token, expires_at)
-- VALUES ('ZFLOW-2024-ABCDE', NOW() + INTERVAL '1 year');
