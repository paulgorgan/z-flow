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

    return new Response(
      JSON.stringify({ ok: true, procesati: users?.length || 0, emailuriTrimise }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
