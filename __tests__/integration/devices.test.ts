import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    device: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2b$12$mocked-hash'),
}))

import { GET, POST } from '@/app/api/devices/route'
import { PATCH } from '@/app/api/devices/[deviceId]/route'
import { prisma } from '@/lib/prisma'

const mockDevice = {
  id: 'dev-1',
  name: 'Test Device',
  apiKeyHash: '$2b$12$hash',
  locationLat: 37.77,
  locationLon: -122.41,
  locationName: 'Living Room',
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ── GET /api/devices ─────────────────────────────────────────────────────────

describe('GET /api/devices', () => {
  it('returns all devices', async () => {
    vi.mocked(prisma.device.findMany).mockResolvedValue([mockDevice] as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.devices).toHaveLength(1)
    expect(body.devices[0].id).toBe('dev-1')
  })

  it('returns an empty array when no devices exist', async () => {
    vi.mocked(prisma.device.findMany).mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(body.devices).toEqual([])
  })
})

// ── POST /api/devices ────────────────────────────────────────────────────────

describe('POST /api/devices', () => {
  beforeEach(() => {
    vi.mocked(prisma.device.create).mockResolvedValue(mockDevice as any)
  })

  it('creates a device and returns deviceId + apiKey', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ESP32 Living Room' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.deviceId).toBe('dev-1')
    expect(typeof body.apiKey).toBe('string')
    expect(body.apiKey.length).toBeGreaterThan(0)
  })

  it('accepts optional location fields', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Garden Sensor',
        locationName: 'Garden',
        locationLat: 51.5,
        locationLon: -0.1,
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationName: 'Kitchen' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ── PATCH /api/devices/:deviceId ─────────────────────────────────────────────

describe('PATCH /api/devices/:deviceId', () => {
  it('updates the device name', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(prisma.device.update).mockResolvedValue({ ...mockDevice, name: 'New Name' } as any)

    const req = new Request('http://localhost/api/devices/dev-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'dev-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.device.name).toBe('New Name')
  })

  it('returns 404 when device does not exist', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(null)

    const req = new Request('http://localhost/api/devices/unknown', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Whatever' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'unknown' }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/devices/dev-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad json',
    })

    const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'dev-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)

    const req = new Request('http://localhost/api/devices/dev-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ deviceId: 'dev-1' }) })
    expect(res.status).toBe(400)
  })
})
