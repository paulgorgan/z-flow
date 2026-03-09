-- ============================================================
-- Z-FLOW Enterprise — Politici RLS (Row Level Security)
-- Rulați acest script în SQL Editor din Supabase Dashboard.
-- Asigură izolarea completă a datelor la nivel auth.uid().
-- ============================================================

-- Activare RLS pe toate tabelele relevante
ALTER TABLE clienti          ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturi          ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnizori        ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturi_platit   ENABLE ROW LEVEL SECURITY;
ALTER TABLE produse          ENABLE ROW LEVEL SECURITY;
ALTER TABLE miscari_stoc     ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptii         ENABLE ROW LEVEL SECURITY;
ALTER TABLE livrari          ENABLE ROW LEVEL SECURITY;
ALTER TABLE soferi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicule         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comenzi_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: macro pentru politici standard per-user_id
-- ============================================================

-- CLIENTI
CREATE POLICY "clienti_select_own" ON clienti FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clienti_insert_own" ON clienti FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clienti_update_own" ON clienti FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clienti_delete_own" ON clienti FOR DELETE USING (auth.uid() = user_id);

-- FACTURI (de încasat)
CREATE POLICY "facturi_select_own" ON facturi FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "facturi_insert_own" ON facturi FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "facturi_update_own" ON facturi FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "facturi_delete_own" ON facturi FOR DELETE USING (auth.uid() = user_id);

-- FURNIZORI
CREATE POLICY "furnizori_select_own" ON furnizori FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "furnizori_insert_own" ON furnizori FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "furnizori_update_own" ON furnizori FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "furnizori_delete_own" ON furnizori FOR DELETE USING (auth.uid() = user_id);

-- FACTURI_PLATIT (de plătit)
CREATE POLICY "facturi_platit_select_own" ON facturi_platit FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "facturi_platit_insert_own" ON facturi_platit FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "facturi_platit_update_own" ON facturi_platit FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "facturi_platit_delete_own" ON facturi_platit FOR DELETE USING (auth.uid() = user_id);

-- PRODUSE
CREATE POLICY "produse_select_own" ON produse FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "produse_insert_own" ON produse FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "produse_update_own" ON produse FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "produse_delete_own" ON produse FOR DELETE USING (auth.uid() = user_id);

-- MISCARI_STOC
CREATE POLICY "miscari_stoc_select_own" ON miscari_stoc FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "miscari_stoc_insert_own" ON miscari_stoc FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "miscari_stoc_delete_own" ON miscari_stoc FOR DELETE USING (auth.uid() = user_id);

-- RECEPTII
CREATE POLICY "receptii_select_own" ON receptii FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receptii_insert_own" ON receptii FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receptii_delete_own" ON receptii FOR DELETE USING (auth.uid() = user_id);

-- LIVRARI
CREATE POLICY "livrari_select_own" ON livrari FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "livrari_insert_own" ON livrari FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "livrari_delete_own" ON livrari FOR DELETE USING (auth.uid() = user_id);

-- SOFERI
CREATE POLICY "soferi_select_own" ON soferi FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "soferi_insert_own" ON soferi FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "soferi_update_own" ON soferi FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "soferi_delete_own" ON soferi FOR DELETE USING (auth.uid() = user_id);

-- VEHICULE
CREATE POLICY "vehicule_select_own" ON vehicule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vehicule_insert_own" ON vehicule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vehicule_update_own" ON vehicule FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vehicule_delete_own" ON vehicule FOR DELETE USING (auth.uid() = user_id);

-- COMENZI_TRANSPORT
CREATE POLICY "comenzi_select_own" ON comenzi_transport FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "comenzi_insert_own" ON comenzi_transport FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comenzi_update_own" ON comenzi_transport FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comenzi_delete_own" ON comenzi_transport FOR DELETE USING (auth.uid() = user_id);

-- PROFILES (fiecare user vede/editează doar propriul profil)
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- Verificare: niciun utilizator nu poate vedea rânduri
-- care nu aparțin propriului auth.uid().
-- Testați cu: SELECT * FROM clienti; (ca alt user — va returna 0 rânduri)
-- ============================================================
