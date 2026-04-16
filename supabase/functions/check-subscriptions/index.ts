// supabase/functions/check-subscriptions/index.ts
// Edge Function: verifică abonamente și trimite emailuri de avertizare
// Rulat prin CRON zilnic — configurat în Supabase Dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const resendApiKey = Deno.env.get('RESEND_API_KEY') // optional — sau alt provider

const supabase = createClient(supabaseUrl, serviceKey)

Deno.serve(async (_req) => {
  try {
    // Obține toți userii cu subscription_expires_at setat
    const { data: users, error } = await supabase
      .from('profiles')
      .select('email, display_name, plan_type, subscription_expires_at')
      .not('subscription_expires_at', 'is', null)
      .eq('is_active', true)

    if (error) throw error

    const acum = new Date()
    const emailuriTrimise: string[] = []

    for (const user of users || []) {
      const expDate = new Date(user.subscription_expires_at)
      const zileRamase = Math.ceil((expDate.getTime() - acum.getTime()) / (1000 * 60 * 60 * 24))

      let subiect = ''
      let mesaj   = ''

      if (zileRamase === 14) {
        subiect = 'Z-FLOW: Abonamentul expiră în 14 zile'
        mesaj = `Abonamentul tău ${user.plan_type} expiră pe ${expDate.toLocaleDateString('ro-RO')}. Contactează echipa Z-FLOW pentru reînnoire.`
      } else if (zileRamase === 7) {
        subiect = '⚠️ Z-FLOW: 7 zile până la expirare'
        mesaj = `Mai ai 7 zile! Abonamentul ${user.plan_type} expiră pe ${expDate.toLocaleDateString('ro-RO')}.`
      } else if (zileRamase === 1) {
        subiect = '🚨 Z-FLOW: Abonamentul expiră MÂINE'
        mesaj = `Ultima zi! Abonamentul expiră pe ${expDate.toLocaleDateString('ro-RO')}. Contactează-ne urgent.`
      } else if (zileRamase === 0 || zileRamase === -1) {
        subiect = '❌ Z-FLOW: Abonamentul a expirat'
        mesaj = `Abonamentul tău Z-FLOW a expirat. Contactează echipa pentru reactivare.`
      }

      if (subiect && user.email && resendApiKey) {
        // Trimite email via Resend (https://resend.com — gratuit 100 emailuri/zi)
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Z-FLOW <noreply@z-flow.ro>',
            to: [user.email],
            subject: subiect,
            html: `<p>${mesaj}</p><p><a href="https://z-flow.ro">z-flow.ro</a></p>`
          })
        })
        emailuriTrimise.push(user.email)
      } else if (subiect) {
        // Fallback: inserează în admin_notifications dacă nu e email provider
        await supabase.from('admin_notifications').insert([{
          user_id: null,
          message: `[AUTO] ${user.email}: ${subiect}`
        }])
        emailuriTrimise.push(user.email + ' (notificare internă)')
      }
    }

    // ── [v74.2] Reminder SĂPTĂMÂNAL scadențe facturi — se trimite lunea ─────────
    // CRON rulează zilnic; reminder-ul de facturi se trimite DOAR lunea (ziua 1).
    // Parametrul ?force_reminder=1 permite declanșare manuală pentru testare.
    const urlParams  = new URL(_req.url)
    const forceRemind = urlParams.searchParams.get('force_reminder') === '1'
    const ziuaSapt   = acum.getDay() // 0=Dum, 1=Lun, 2=Mar … 6=Sâm
    const REMINDER_ZILE = 7          // fereastra: scadențe în ≤7 zile
    const aziISO    = acum.toISOString().split('T')[0]
    const limitaISO = new Date(acum.getTime() + REMINDER_ZILE * 86_400_000).toISOString().split('T')[0]

    const reminderEmailuriTrimise: string[] = []

    if (ziuaSapt === 1 || forceRemind) {
    // Facturi de încasat (clienți) cu scadența în ≤7 zile
    const { data: facturiSc } = await supabase
      .from('facturi')
      .select('user_id, numar_factura, data_scadenta, valoare')
      .neq('status_plata', 'Incasat')
      .gte('data_scadenta', aziISO)
      .lte('data_scadenta', limitaISO)

    // Facturi de plătit (furnizori) cu scadența în ≤7 zile
    const { data: facturiPlatitSc } = await supabase
      .from('facturi_platit')
      .select('user_id, numar_factura, data_scadenta, valoare')
      .neq('status_plata', 'Platit')
      .gte('data_scadenta', aziISO)
      .lte('data_scadenta', limitaISO)

    // Grupăm pe user_id
    type FRow = { numar_factura: string; data_scadenta: string; valoare: number }
    const reminderMap: Record<string, { clienti: FRow[]; furnizori: FRow[] }> = {}

    for (const f of facturiSc || []) {
      const uid = f.user_id as string
      if (!reminderMap[uid]) reminderMap[uid] = { clienti: [], furnizori: [] }
      reminderMap[uid].clienti.push(f as FRow)
    }
    for (const f of facturiPlatitSc || []) {
      const uid = f.user_id as string
      if (!reminderMap[uid]) reminderMap[uid] = { clienti: [], furnizori: [] }
      reminderMap[uid].furnizori.push(f as FRow)
    }

    // Colectăm emailurile pentru user_id-urile implicate
    const remindUserIds = Object.keys(reminderMap)

    if (remindUserIds.length > 0) {
      // neq('is_active', false) = include și profiluri cu is_active NULL
      const { data: profiluri } = await supabase
        .from('profiles')
        .select('user_id, email, email_alerte, display_name')
        .in('user_id', remindUserIds)
        .neq('is_active', false)

      for (const profil of profiluri || []) {
        const uid   = profil.user_id as string
        const email = (profil.email_alerte as string) || (profil.email as string) // [v75.36] prefer email_alerte
        const data  = reminderMap[uid]
        if (!email || !data) continue

        const numeUser = (profil.display_name as string) || email

        // Construim HTML tabel facturi clienți
        let htmlClienti = ''
        if (data.clienti.length > 0) {
          const randuri = data.clienti.map(f =>
            `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0">${f.numar_factura}</td>` +
            `<td style="padding:4px 8px;border:1px solid #e2e8f0">${f.data_scadenta}</td>` +
            `<td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${Number(f.valoare).toLocaleString('ro-RO')} RON</td></tr>`
          ).join('')
          htmlClienti = `
            <h3 style="color:#b45309;margin:16px 0 6px">📥 Facturi de încasat (clienți)</h3>
            <table style="border-collapse:collapse;width:100%;font-size:13px">
              <tr style="background:#fef3c7"><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Nr. factură</th>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Scadență</th>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">Valoare</th></tr>
              ${randuri}
            </table>`
        }

        // Construim HTML tabel facturi furnizori
        let htmlFurnizori = ''
        if (data.furnizori.length > 0) {
          const randuri = data.furnizori.map(f =>
            `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0">${f.numar_factura}</td>` +
            `<td style="padding:4px 8px;border:1px solid #e2e8f0">${f.data_scadenta}</td>` +
            `<td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${Number(f.valoare).toLocaleString('ro-RO')} RON</td></tr>`
          ).join('')
          htmlFurnizori = `
            <h3 style="color:#dc2626;margin:16px 0 6px">📤 Facturi de plătit (furnizori)</h3>
            <table style="border-collapse:collapse;width:100%;font-size:13px">
              <tr style="background:#fee2e2"><th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Nr. factură</th>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Scadență</th>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">Valoare</th></tr>
              ${randuri}
            </table>`
        }

        const htmlEmail = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
            <div style="background:#f59e0b;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;color:#fff;font-size:18px">⏰ Reminder scadențe Z-FLOW</h2>
              <p style="margin:4px 0 0;color:#fef3c7;font-size:13px">Facturi cu scadența în următoarele ${REMINDER_ZILE} zile</p>
            </div>
            <div style="background:#fff;padding:20px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px">
              <p>Bună, <strong>${numeUser}</strong>,</p>
              <p>Avem ${data.clienti.length + data.furnizori.length} factură(i) cu scadența în ≤${REMINDER_ZILE} zile care necesită atenție:</p>
              ${htmlClienti}
              ${htmlFurnizori}
              <p style="margin-top:20px;font-size:12px;color:#64748b">
                Intră în <a href="https://z-flow.ro" style="color:#f59e0b">Z-FLOW</a> pentru a vedea detaliile și a actualiza statusul facturilor.
              </p>
            </div>
          </div>`

        if (resendApiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Z-FLOW <noreply@z-flow.ro>',
              to: [email],
              subject: `⏰ Z-FLOW: ${data.clienti.length + data.furnizori.length} factură(i) scadente în ${REMINDER_ZILE} zile`,
              html: htmlEmail
            })
          })
          reminderEmailuriTrimise.push(email)
        } else {
          await supabase.from('admin_notifications').insert([{
            user_id: uid,
            message: `[REMINDER] ${email}: ${data.clienti.length} clienti + ${data.furnizori.length} furnizori scadente ≤${REMINDER_ZILE}z`
          }])
          reminderEmailuriTrimise.push(email + ' (notificare internă)')
        }
      }
    }
    } // end if (ziuaSapt === 1 || forceRemind)

    return new Response(
      JSON.stringify({
        ok: true,
        procesati: users?.length || 0,
        emailuriTrimise,
        reminder: {
          ran: ziuaSapt === 1 || forceRemind,
          emailuriTrimise: reminderEmailuriTrimise
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
