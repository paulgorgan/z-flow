# Z-FLOW — Configurare Email Branding Supabase

Toate emailurile de autentificare (confirmare cont, resetare parolă, invitație, Magic Link)
vor veni **din partea Z-FLOW**, cu design personalizat, nu cu template-ul generic Supabase.

---

## Pasul 1 — SMTP Custom (emailuri trimise din domeniul tău)

Fără SMTP custom, emailurile vin de la `noreply@mail.supabase.io`.
Cu SMTP custom, vin de la `noreply@zflow.ro` (sau orice adresă dorești).

### Opțiunea recomandată: Resend (gratuit 3000 emailuri/lună)

1. Creează cont pe **resend.com**
2. Adaugă domeniu: `zflow.ro` → verifică DNS (adaugă recordurile TXT/MX indicate)
3. Creează API Key în Resend Dashboard
4. Configurează în **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**:

```
Enable Custom SMTP: ON

SMTP Host:     smtp.resend.com
SMTP Port:     465
SMTP User:     resend
SMTP Password: re_xxxxxxxxxxxxxxxxx   ← API key din Resend
Sender Email:  noreply@zflow.ro
Sender Name:   Z-FLOW Enterprise
```

### Alternativă: SendGrid, Mailgun, sau serviciul de email al hostingului

```
SendGrid:
  Host: smtp.sendgrid.net
  Port: 465
  User: apikey
  Pass: SG.xxxxx (API Key)

Mailgun:
  Host: smtp.mailgun.org
  Port: 465
  User: postmaster@mg.zflow.ro
  Pass: (parola din Mailgun)
```

---

## Pasul 2 — Template-uri Email personalizate

**Supabase Dashboard → Authentication → Email Templates**

Există 6 template-uri de personalizat. Le modifici pe rând selectând din dropdown.

---

### Template 1: Confirm signup (Confirmare cont nou)

**Subject:**
```
Confirmă contul tău Z-FLOW
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmare cont Z-FLOW</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">Z-FLOW</div>
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Enterprise</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Bun venit în Z-FLOW!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Contul tău a fost creat. Apasă butonul de mai jos pentru a-l confirma și a începe să folosești aplicația.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                 style="display:inline-block;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.3px;">
                Confirmă contul
              </a>
            </div>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              Dacă nu ai creat tu acest cont, poți ignora acest email în siguranță.<br>
              Link-ul expiră în <strong>24 de ore</strong>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Z-FLOW Enterprise · Gestionare facturi și logistică<br>
              <a href="https://zflow.ro" style="color:#1d4ed8;text-decoration:none;">zflow.ro</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

### Template 2: Reset password (Resetare parolă)

**Subject:**
```
Resetează parola Z-FLOW
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">Z-FLOW</div>
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Enterprise</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Resetare parolă</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Am primit o solicitare de resetare a parolei pentru contul asociat acestui email.<br>
              Apasă butonul de mai jos pentru a seta o parolă nouă.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                 style="display:inline-block;background:#dc2626;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                Resetează parola
              </a>
            </div>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
              Dacă nu ai solicitat tu resetarea, ignoră acest email — parola ta nu va fi modificată.<br>
              Link-ul expiră în <strong>1 oră</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Z-FLOW Enterprise · <a href="https://zflow.ro" style="color:#1d4ed8;text-decoration:none;">zflow.ro</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

### Template 3: Magic Link (login fără parolă)

**Subject:**
```
Link de autentificare Z-FLOW
```

**Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">Z-FLOW</div>
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Enterprise</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">Autentificare Z-FLOW</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Apasă butonul de mai jos pentru a te autentifica. Nu ai nevoie de parolă.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="{{ .ConfirmationURL }}"
                 style="display:inline-block;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                Intră în Z-FLOW
              </a>
            </div>
            <p style="margin:0;font-size:13px;color:#94a3b8;">Link-ul expiră în <strong>1 oră</strong> și poate fi folosit o singură dată.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Z-FLOW Enterprise · <a href="https://zflow.ro" style="color:#1d4ed8;text-decoration:none;">zflow.ro</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

### Template 4: Change Email Address (schimbare email)

**Subject:**
```
Confirmă noul email Z-FLOW
```

**Body:** Folosește același layout ca Template 1, cu textul:
```
Ai solicitat schimbarea adresei de email pentru contul tău Z-FLOW.
Apasă butonul de mai jos pentru a confirma noua adresă.
```
Buton: `Confirmă noul email` (albastru `#1d4ed8`)

---

### Template 5: Invite User (invitație utilizator nou)

**Subject:**
```
Ești invitat în Z-FLOW Enterprise
```

**Body:** Același layout, cu textul:
```
Ai primit o invitație să te alături Z-FLOW Enterprise.
Apasă butonul de mai jos pentru a-ți crea contul.
```
Buton: `Acceptă invitația` (verde `#16a34a`)

---

## Pasul 3 — Variabile disponibile în template-uri

| Variabilă | Descriere |
|-----------|-----------|
| `{{ .ConfirmationURL }}` | Link-ul principal de acțiune |
| `{{ .Email }}` | Emailul utilizatorului |
| `{{ .Token }}` | Token-ul OTP (dacă e nevoie) |
| `{{ .SiteURL }}` | URL-ul aplicației (configurat în Dashboard) |

---

## Pasul 4 — Verificare după configurare

1. **Test SMTP:** Supabase Dashboard → Authentication → SMTP → butonul "Test"
2. **Test template:** Încearcă "Forgot Password" din aplicație cu un email real
3. **Verifică spam folder** — emailurile noi pot fi flagate inițial
4. **DNS SPF/DKIM** — Resend/SendGrid adaugă automat aceste recorduri pentru domeniu verificat
   → Important pentru deliverability (emailurile să nu ajungă în spam)

---

## Sumar comenzi DNS necesare (dacă folosești Resend)

Adaugă în panoul DNS al domeniului `zflow.ro`:

```
TXT  @              v=spf1 include:_spf.resend.com ~all
TXT  resend._domainkey    (valoarea dată de Resend în Dashboard)
CNAME  click.zflow.ro    send.resend.com  (tracking opțional)
```
