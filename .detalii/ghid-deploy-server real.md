# Z-FLOW — Ghid Deploy Server Real cu Domeniu

---

## Starea curentă a aplicației

✅ Funcțional ca SPA/PWA fără build step  
✅ Supabase conectat cu RLS activ  
✅ Cheia anon injectabilă extern (nu hardcodată)  
✅ Service Worker (sw.js v61.1) — **bump necesar înainte de deploy**  
✅ manifest.json prezent  
✅ Edge Functions deployate (check-subscriptions, anaf-efactura)  

❌ Nu există fișier server config (nginx / Caddy)  
❌ HTTPS nu e configurat la nivel de server  
❌ Cache headers lipsă (performanță)  
❌ Meta tags incomplete (description, og:title, canonical)  

---

## Opțiunea A — Cloudflare Pages (RECOMANDAT — Gratuit, CDN global, HTTPS automat)

### Pași:
1. Push repo pe GitHub (dacă nu e deja)
2. Cloudflare Dashboard → Pages → Connect to Git
3. Framework preset: **None** (static site)
4. Build command: **(gol)**
5. Build output directory: `/` (root)
6. Adaugă domeniu custom în Settings → Custom Domains

### Fișier `_headers` (crează-l în root repo):
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(self)

/js/*
  Cache-Control: public, max-age=31536000, immutable

/css/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/manifest.json
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
```

### Configurare cheie Supabase în producție:
În Cloudflare Pages → Settings → Environment Variables:
```
SUPABASE_KEY = sb_publishable_nKFEv_6AOyKBFp3f_AnZmw_MMZ9MXl5
```
Și în `index.html`, înainte de scripturile JS (adaugă în `<head>`):
```html
<meta name="zflow-key" content="__SUPABASE_KEY__">
```
Cloudflare Pages poate face substituție prin Workers sau Build Plugin.

**Alternativ simplu:** lasă cheia în fallback din supabase.js — cheia anon Supabase este
intenționat publică; securitatea vine din RLS, nu din ascunderea cheii.

---

## Opțiunea B — VPS (Ubuntu) cu Nginx + Certbot

### nginx.conf pentru Z-FLOW:
```nginx
server {
    listen 80;
    server_name zflow.ro www.zflow.ro;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name zflow.ro www.zflow.ro;

    # SSL (generat de Certbot)
    ssl_certificate /etc/letsencrypt/live/zflow.ro/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zflow.ro/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/z-flow;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # SPA routing — toate rutele → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets 1 an
    location ~* \.(js|css|png|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # sw.js și index.html NO cache
    location ~* (sw\.js|index\.html|manifest\.json)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
}
```

### Comenzi deploy:
```bash
# 1. Instalare nginx + certbot
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y

# 2. Copiază fișierele aplicației
sudo mkdir -p /var/www/z-flow
sudo cp -r /path/to/z-flow/* /var/www/z-flow/

# 3. Configurare nginx
sudo nano /etc/nginx/sites-available/z-flow
# (copiează config de mai sus)
sudo ln -s /etc/nginx/sites-available/z-flow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. SSL automat Let's Encrypt
sudo certbot --nginx -d zflow.ro -d www.zflow.ro

# 5. Reînnoire automată SSL (cron)
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

---

## Configurare Supabase pentru domeniu de producție

### 1. Allowed URLs (obligatoriu)
Supabase Dashboard → Authentication → URL Configuration:
```
Site URL: https://zflow.ro
Redirect URLs:
  https://zflow.ro
  https://www.zflow.ro
  https://zflow.ro/**
```

### 2. CORS pentru Edge Functions
În fiecare Edge Function (anaf-efactura, check-subscriptions), asigură:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://zflow.ro',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

## Checklist pre-deploy

```
□ sw.js: bump CACHE_NAME la 'zflow-v62.0'
□ index.html: adaugă <meta name="description" content="Z-FLOW Enterprise — Gestionare facturi și logistică">
□ index.html: adaugă <meta property="og:title" content="Z-FLOW Enterprise">
□ index.html: adaugă <link rel="canonical" href="https://zflow.ro">
□ Supabase Dashboard: actualizează Site URL la domeniul de producție
□ Supabase Dashboard: adaugă domeniu în Redirect URLs
□ DNS: A record zflow.ro → IP server / CNAME pentru Cloudflare Pages
□ Test PWA install pe mobile după deploy
□ Test Service Worker: DevTools → Application → Service Workers → Unregister → Reload
```

---

## Bump SW (înainte de orice deploy)

**Fișier:** `sw.js`

```
GĂSEȘTE:
    'zflow-v61.1'

ÎNLOCUIEȘTE CU:
    'zflow-v62.0'
```
