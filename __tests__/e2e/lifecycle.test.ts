/**
 * End-to-end API lifecycle test.
 *
 * Requires a real PostgreSQL database.
 * Set DATABASE_URL (or TEST_DATABASE_URL) in your environment before running.
 *
 *   TEST_DATABASE_URL="postgresql://..." npm run test:e2e
 *
 * The test creates its own device and cleans up after itself, so it is
 * safe to run against a shared development database.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Stub weather so we don't call OpenWeatherMap during e2e
vi.stubGlobal('fetch', async (url: string) => {
  if (typeof url === 'string' && url.includes('openweathermap')) {
    return { ok: false } // weather returns null → no weather fields
  }
  // Pass through anything else (shouldn't happen in these tests)
  return { ok: false }
})

import { POST as registerDevice } from '@/app/api/devices/route'
import { POST as addPlant } from '@/app/api/devices/[deviceId]/plants/route'
import { POST as submitReading } from '@/app/api/readings/route'
import { DELETE as deleteReading } from '@/app/api/readings/[readingId]/route'
import { GET as getReadings } from '@/app/api/devices/[deviceId]/readings/route'
import { GET as getLatest } from '@/app/api/devices/[deviceId]/latest/route'
import { POST as createCommand } from '@/app/api/commands/route'
import { GET as getPendingCommand } from '@/app/api/devices/[deviceId]/commands/pending/route'
import { POST as reportResult } from '@/app/api/commands/[commandId]/result/route'
import { prisma } from '@/lib/prisma'

// Override DATABASE_URL with TEST_DATABASE_URL if provided
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

// State shared across the ordered test steps
let deviceId: string
let apiKey: string
let plantId: string
let readingId: string
let commandId: string

describe('Device registration', () => {
  it('registers a new device and returns a one-time API key', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Test Device', locationName: 'Lab' }),
    })

    const res = await registerDevice(req)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.deviceId).toBe('string')
    expect(typeof body.apiKey).toBe('string')
    expect(body.apiKey.length).toBeGreaterThan(0)

    deviceId = body.deviceId
    apiKey = body.apiKey
  })
})

describe('Plant management', () => {
  it('adds a plant profile to the device', async () => {
    const req = new Request(`http://localhost/api/devices/${deviceId}/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Basil',
        type: 'Herb',
        targetMinMoisture: 30,
        targetMaxMoisture: 65,
      }),
    })

    const res = await addPlant(req, { params: Promise.resolve({ deviceId }) })
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.plant.name).toBe('E2E Basil')
    expect(body.plant.deviceId).toBe(deviceId)

    plantId = body.plant.id
  })
})

describe('Reading submission', () => {
  it('rejects a reading without device auth headers', async () => {
    const req = new Request('http://localhost/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, soilMoisture: 45, rawMoisture: 2000, pumpState: false, watered: false }),
    })

    const res = await submitReading(req)
    expect(res.status).toBe(401)
  })

  it('rejects a reading with a wrong API key', async () => {
    const req = new Request('http://localhost/api/readings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        'x-device-key': 'completely-wrong-key',
      },
      body: JSON.stringify({ deviceId, soilMoisture: 45, rawMoisture: 2000, pumpState: false, watered: false }),
    })

    const res = await submitReading(req)
    expect(res.status).toBe(401)
  })

  it('accepts a reading with correct device credentials', async () => {
    const req = new Request('http://localhost/api/readings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        'x-device-key': apiKey,
      },
      body: JSON.stringify({
        deviceId,
        plantId,
        soilMoisture: 45,
        rawMoisture: 2000,
        pumpState: false,
        watered: false,
      }),
    })

    const res = await submitReading(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.reading.soilMoisture).toBe(45)

    readingId = body.reading.id
  })

  it('updates device lastSeenAt on reading submission', async () => {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    expect(device?.lastSeenAt).not.toBeNull()
  })
})

describe('Reading history', () => {
  it('returns the submitted reading in the history', async () => {
    const req = new Request(`http://localhost/api/devices/${deviceId}/readings`)
    const res = await getReadings(req, { params: Promise.resolve({ deviceId }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.readings.length).toBeGreaterThanOrEqual(1)
    expect(body.readings[0].id).toBe(readingId)
  })

  it('respects the limit query parameter', async () => {
    const req = new Request(`http://localhost/api/devices/${deviceId}/readings?limit=1`)
    const res = await getReadings(req, { params: Promise.resolve({ deviceId }) })
    const body = await res.json()
    expect(body.readings.length).toBeLessThanOrEqual(1)
  })
})

describe('Latest reading endpoint', () => {
  it('returns the device, latest reading, and plant', async () => {
    const req = new Request(`http://localhost/api/devices/${deviceId}/latest`)
    const res = await getLatest(req, { params: Promise.resolve({ deviceId }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.device.id).toBe(deviceId)
    expect(body.latestReading.id).toBe(readingId)
    expect(body.plant.id).toBe(plantId)
  })
})

describe('Pump command flow', () => {
  it('creates a pump command', async () => {
    const req = new Request('http://localhost/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, durationMs: 3000 }),
    })

    const res = await createCommand(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.command.status).toBe('pending')
    expect(body.command.durationMs).toBe(3000)

    commandId = body.command.id
  })

  it('rejects a second command when one is already pending', async () => {
    const req = new Request('http://localhost/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, durationMs: 3000 }),
    })

    const res = await createCommand(req)
    expect(res.status).toBe(409)
  })

  it('device can poll and receive the pending command', async () => {
    const req = new Request(`http://localhost/api/devices/${deviceId}/commands/pending`, {
      headers: {
        'x-device-id': deviceId,
        'x-device-key': apiKey,
      },
    })

    const res = await getPendingCommand(req, { params: Promise.resolve({ deviceId }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.command.id).toBe(commandId)
    expect(body.command.durationMs).toBe(3000)
  })

  it('command is marked as accepted after being polled', async () => {
    const cmd = await prisma.pumpCommand.findUnique({ where: { id: commandId } })
    expect(cmd?.status).toBe('accepted')
    expect(cmd?.acceptedAt).not.toBeNull()
  })

  it('device reports the command as completed', async () => {
    const req = new Request(`http://localhost/api/commands/${commandId}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        'x-device-key': apiKey,
      },
      body: JSON.stringify({ status: 'completed' }),
    })

    const res = await reportResult(req, { params: Promise.resolve({ commandId }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.command.status).toBe('completed')
    expect(body.command.completedAt).not.toBeNull()
  })
})

describe('Reading deletion', () => {
  it('deletes the test reading', async () => {
    const res = await deleteReading(
      new Request(`http://localhost/api/readings/${readingId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ readingId }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 404 when deleting an already-deleted reading', async () => {
    const res = await deleteReading(
      new Request(`http://localhost/api/readings/${readingId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ readingId }) }
    )
    expect(res.status).toBe(404)
  })
})

// ── Cleanup ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Cascade deletes plants, readings, and commands
  if (deviceId) {
    await prisma.device.delete({ where: { id: deviceId } }).catch(() => {})
  }
  await prisma.$disconnect()
})
