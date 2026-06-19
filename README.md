# Aina Backend

[![CI](https://github.com/your-username/aina-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/aina-backend/actions/workflows/ci.yml)

> Self-hosted plant monitoring backend for ESP32 soil sensors.

Aina Backend receives soil moisture readings from ESP32 microcontrollers over HTTPS, stores them in PostgreSQL, and exposes a REST API that any frontend (PWA, native app, home automation) can consume — no cloud account required.

---

## Features

- **Device provisioning** — register devices via API, receive a one-time API key
- **Sensor readings** — soil moisture, pump state, optional temperature / humidity / light / air quality
- **Automatic weather enrichment** — outdoor weather attached to each reading via OpenWeatherMap (optional)
- **Remote pump control** — queue commands via API; device polls and reports back
- **Reading history** — browse and delete past readings per device
- **Open REST API** — consume from any frontend; Postman collection included
- **Self-hosted** — your data stays on your infrastructure

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Route Handlers) |
| Database | PostgreSQL via Prisma ORM |
| Validation | Zod |
| Auth | bcryptjs — per-device API key with pepper |
| Weather | OpenWeatherMap API (optional) |
| Firmware | ESP32 / Arduino (C++) |

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local or hosted)
- An OpenWeatherMap API key (free tier — optional)

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-username/aina-backend.git
cd aina-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and DEVICE_API_KEY_PEPPER

# 4. Create the database schema
npx prisma migrate deploy

# 5. Generate the Prisma client
npx prisma generate

# 6. (Optional) Seed with sample data
npx prisma db seed

# 7. Start the development server
npm run dev
```

The API is available at `http://localhost:3000/api`. Visiting `http://localhost:3000` redirects to `/api/devices`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DEVICE_API_KEY_PEPPER` | Yes | Secret string appended to device keys before hashing |
| `OPENWEATHER_API_KEY` | No | Enables weather enrichment on readings |
| `DEV_BYPASS_AUTH` | No | Set to `true` to skip device key checks in development |

See [`.env.example`](.env.example) for a ready-to-fill template.

---

## API Reference

### Device Authentication

Endpoints that require device auth use two request headers:

```
x-device-id:  <deviceId>
x-device-key: <plaintext key returned at registration>
```

Management endpoints (devices, commands, plants, readings history) require no authentication in the current version.

---

### Devices

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/devices` | — | List all registered devices |
| `POST` | `/api/devices` | — | Register a new device; returns `{ deviceId, apiKey }` **once** |
| `PATCH` | `/api/devices/:deviceId` | — | Update device name or location |
| `GET` | `/api/devices/:deviceId/latest` | — | Device info + latest reading + plant |
| `GET` | `/api/devices/:deviceId/readings?limit=100` | — | Reading history (max 500) |
| `POST` | `/api/devices/:deviceId/plants` | — | Add a plant profile to a device |

**Register device body:**
```json
{
  "name": "Living Room Fern",
  "locationName": "Living Room",
  "locationLat": 37.77,
  "locationLon": -122.41
}
```

**Update device body (all fields optional):**
```json
{
  "name": "Bedroom Cactus",
  "locationName": "Bedroom",
  "locationLat": 37.77,
  "locationLon": -122.41
}
```

---

### Readings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/readings` | Device key | Submit a sensor reading |
| `DELETE` | `/api/readings/:readingId` | — | Delete a specific reading |

**Submit reading body:**
```json
{
  "deviceId": "...",
  "plantId": "...",
  "soilMoisture": 42,
  "rawMoisture": 2100,
  "pumpState": false,
  "watered": false,
  "temperature": 22.5,
  "humidity": 58.0,
  "light": 300,
  "airQuality": 95
}
```

`plantId`, `temperature`, `humidity`, `light`, and `airQuality` are optional. Weather fields are added server-side if `OPENWEATHER_API_KEY` is set and the device has coordinates.

---

### Pump Commands

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/commands` | — | Queue a pump command for a device |
| `GET` | `/api/devices/:deviceId/commands/pending` | Device key | Poll for the next pending command |
| `POST` | `/api/commands/:commandId/result` | Device key | Report command outcome |

**Create command body:**
```json
{ "deviceId": "...", "durationMs": 3000 }
```

Only one pending command per device is allowed at a time (409 if one already exists).

**Report result body:**
```json
{ "status": "completed" }
```

`status` must be one of: `completed`, `failed`, `rejected`.

---

### Plants

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/plants` | — | List all plant profiles |

---

## Data Model

```
Device ──< Reading
Device ──< Plant
Device ──< PumpCommand
Plant  ──< Reading  (optional link)
```

| Model | Key Fields |
|---|---|
| `Device` | `id`, `name`, `apiKeyHash`, `locationLat`, `locationLon`, `lastSeenAt` |
| `Plant` | `name`, `type`, `targetMinMoisture`, `targetMaxMoisture` |
| `Reading` | `soilMoisture`, `rawMoisture`, `pumpState`, `watered`, weather fields |
| `PumpCommand` | `durationMs`, `status`, `acceptedAt`, `completedAt`, `failedAt` |

---

## ESP32 Firmware Flow

1. On boot: connect to WiFi, load stored `deviceId` and `apiKey`.
2. Every hour (non-blocking `millis()` timer):
   - Read soil moisture ADC.
   - `POST /api/readings` with sensor values.
   - `GET /api/devices/:id/commands/pending` — check for pending pump commands.
   - If a command exists: run the pump for `durationMs`, then `POST /api/commands/:id/result`.
3. Between readings: display idle animation on LCD (worm crawl / plant grow).

---

## Frontend / PWA

See [`PWA.md`](PWA.md) for a complete guide to building a standalone Progressive Web App that consumes this API from a separate Next.js project.

---

## Postman Collection

Import [`aina-backend.postman_collection.json`](aina-backend.postman_collection.json) into Postman. Set the `baseUrl` collection variable to your server URL. The **Register device** and **Submit reading** requests auto-populate `deviceId`, `deviceKey`, and `readingId` variables via test scripts.

---

## Project Structure

```
app/
  api/                         # REST API route handlers
    devices/
      [deviceId]/
        latest/                # GET latest reading + device
        readings/              # GET reading history
        plants/                # POST add plant
        commands/pending/      # GET next pending command (device auth)
      route.ts                 # GET list / POST register
      [deviceId]/route.ts      # PATCH update
    readings/
      route.ts                 # POST submit reading (device auth)
      [readingId]/route.ts     # DELETE reading
    commands/
      route.ts                 # POST create command
      [commandId]/result/      # POST report result (device auth)
    plants/
      route.ts                 # GET list
  generated/
    prisma/                    # Generated Prisma client (do not edit)
  page.tsx                     # Redirects to /api/devices
lib/
  auth-device.ts               # Device key verification (bcrypt + pepper)
  prisma.ts                    # Prisma client singleton
  validators.ts                # Zod schemas for all request bodies
  weather.ts                   # OpenWeatherMap integration
prisma/
  schema.prisma                # Database schema
  seed.ts                      # Sample data
__tests__/
  unit/                        # Validator, auth, and weather unit tests
  integration/                 # API route integration tests
  e2e/                         # Full lifecycle end-to-end tests
```

---

## Testing

```bash
# Unit tests (validators, auth helpers)
npm test

# End-to-end API tests (requires a running Postgres DB)
npm run test:e2e
```

See [`DEPLOY.md`](DEPLOY.md) for CI setup.

---

## Contributing

Contributions are welcome. Please open an issue first to discuss significant changes.

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes and add tests where applicable
3. Run `npm test` to verify nothing is broken
4. Open a pull request with a clear description of what changed and why

---

## Deploying Your Own Instance

See [`DEPLOY.md`](DEPLOY.md) for step-by-step instructions covering Railway, Vercel + Supabase, and Docker Compose.

The source code is open. Your data and credentials are private to your deployment.

---

## License

[MIT](LICENSE) — free to use, modify, and self-host.
