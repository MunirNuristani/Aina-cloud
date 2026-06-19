# Deploying Aina Backend

This guide covers three deployment options for a private instance of Aina Backend.
The source code is open; your database, credentials, and device data are entirely private to your deployment.

---

## Option 1 — Railway (Recommended)

Railway is the fastest path: it provisions Postgres and deploys the Next.js app in the same project with a single command.

### 1. Create a Railway project

```bash
npm install -g @railway/cli
railway login
railway init          # creates a new project
railway add postgres  # provisions a Postgres database
```

### 2. Set environment variables

In the Railway dashboard → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-injected by Railway when you link the Postgres plugin |
| `DEVICE_API_KEY_PEPPER` | A long random secret: `openssl rand -hex 32` |
| `OPENWEATHER_API_KEY` | Your OpenWeatherMap key (optional) |

### 3. Deploy

```bash
railway up
```

Railway detects Next.js automatically. On first deploy, run the database setup:

```bash
railway run npx prisma db push
```

Your API will be live at `https://<your-app>.railway.app`.

---

## Option 2 — Vercel + Supabase

### 1. Create a Supabase database

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Settings → Database** and copy the **Connection string** (use the *Transaction* mode URL for serverless).

### 2. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### 3. Set environment variables

In the Vercel dashboard → your project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Supabase connection string |
| `DEVICE_API_KEY_PEPPER` | A long random secret: `openssl rand -hex 32` |
| `OPENWEATHER_API_KEY` | Your OpenWeatherMap key (optional) |

### 4. Push the schema

```bash
DATABASE_URL="<your-supabase-url>" npx prisma db push
```

---

## Option 3 — Docker Compose (Self-hosted VPS)

Use this if you want to run everything on your own server (e.g. a Raspberry Pi, DigitalOcean droplet, or home server).

### 1. Create `docker-compose.yml` on your server

```yaml
version: '3.9'

services:
  db:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: aina
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: aina_cloud
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: node:20-alpine
    restart: unless-stopped
    working_dir: /app
    command: sh -c "npx prisma db push && npm start"
    environment:
      DATABASE_URL: postgresql://aina:${POSTGRES_PASSWORD}@db:5432/aina_cloud
      DEVICE_API_KEY_PEPPER: ${DEVICE_API_KEY_PEPPER}
      OPENWEATHER_API_KEY: ${OPENWEATHER_API_KEY}
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      - db
    volumes:
      - .:/app

volumes:
  pgdata:
```

### 2. Create a `.env` file on the server (never commit this)

```bash
POSTGRES_PASSWORD=choose-a-strong-password
DEVICE_API_KEY_PEPPER=<output of: openssl rand -hex 32>
OPENWEATHER_API_KEY=your-key-or-leave-blank
```

### 3. Clone the repo and start

```bash
git clone https://github.com/your-username/aina-backend.git .
npm ci
docker compose up -d
```

### 4. (Optional) Put Nginx in front with HTTPS

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Use [Certbot](https://certbot.eff.org/) to obtain the SSL certificate:
```bash
certbot --nginx -d api.yourdomain.com
```

---

## Production Checklist

- [ ] `DEVICE_API_KEY_PEPPER` is set to a strong random value and never changes after devices are registered
- [ ] `DATABASE_URL` points to a persistent database with backups enabled
- [ ] The app is served over HTTPS (ESP32 devices require it)
- [ ] `NODE_ENV=production` is set (disables `DEV_BYPASS_AUTH`)
- [ ] Your `.env` file is **not** committed to the repository

---

## Updating a Running Deployment

```bash
git pull
npm ci
npx prisma db push   # apply any schema changes
# restart your service (docker compose restart app, railway up, vercel deploy, etc.)
```

---

## Keeping Your Deployment Private

The source code is MIT-licensed and public. Your deployment is private because:

- Device credentials are stored only in your database as bcrypt hashes
- The `DEVICE_API_KEY_PEPPER` is unique to your deployment and never in the repo
- Your `DATABASE_URL` is only in your environment variables
- You control who can reach the server (firewall, VPN, etc.)

There is no shared backend, no analytics, and no callbacks to any external service except OpenWeatherMap (which you can opt out of by not setting `OPENWEATHER_API_KEY`).
