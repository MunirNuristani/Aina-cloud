import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    reading: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),   // called to build the $transaction argument array
    },
    device: {
      findUnique: vi.fn(),
      update: vi.fn(),   // called to build the $transaction argument array
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth-device', () => ({
  authenticateDevice: vi.fn(),
}))

vi.mock('@/lib/weather', () => ({
  getCurrentWeather: vi.fn().mockResolvedValue(null),
}))

import { POST } from '@/app/api/readings/route'
import { DELETE } from '@/app/api/readings/[readingId]/route'
import { authenticateDevice } from '@/lib/auth-device'
import { prisma } from '@/lib/prisma'

const mockDevice = {
  id: 'dev-1',
  name: 'Test Device',
  apiKeyHash: 'hash',
  locationLat: null,
  locationLon: null,
  locationName: null,
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validBody = {
  deviceId: 'dev-1',
  soilMoisture: 42,
  rawMoisture: 2100,
  pumpState: false,
  watered: false,
}

function makeSubmitRequest(body: unknown, deviceId = 'dev-1', deviceKey = 'key') {
  return new Request('http://localhost/api/readings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      'x-device-key': deviceKey,
    },
    body: JSON.stringify(body),
  })
}

// ── POST /api/readings ───────────────────────────────────────────────────────

describe('POST /api/readings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when authentication fails', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({
      ok: false, status: 401, message: 'Missing headers',
    })

    const res = await POST(makeSubmitRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when deviceId in body does not match authenticated device', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({
      ok: true, device: { ...mockDevice, id: 'other-dev' } as any,
    })

    // body deviceId is 'dev-1' but auth device is 'other-dev'
    const res = await POST(makeSubmitRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })

    const req = new Request('http://localhost/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-device-id': 'dev-1', 'x-device-key': 'key' },
      body: 'not-json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })

    // missing soilMoisture, rawMoisture, etc.
    const res = await POST(makeSubmitRequest({ deviceId: 'dev-1' }))
    expect(res.status).toBe(400)
  })

  it('creates a reading and returns 200 on success', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })

    const createdReading = { id: 'reading-1', soilMoisture: 42, createdAt: new Date() }
    vi.mocked(prisma.$transaction).mockResolvedValue([createdReading, mockDevice] as any)

    const res = await POST(makeSubmitRequest(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.reading.id).toBe('reading-1')
    expect(body.reading.soilMoisture).toBe(42)
  })

  it('includes weather data in the response when available', async () => {
    const { getCurrentWeather } = await import('@/lib/weather')
    vi.mocked(getCurrentWeather).mockResolvedValue({
      weatherTemp: 72,
      weatherHumidity: 60,
      weatherPressure: 1013,
      weatherDescription: 'clear sky',
    })
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })

    const createdReading = { id: 'reading-2', soilMoisture: 42, createdAt: new Date() }
    vi.mocked(prisma.$transaction).mockResolvedValue([createdReading, mockDevice] as any)

    const res = await POST(makeSubmitRequest(validBody))
    const body = await res.json()
    expect(body.reading.weather?.weatherTemp).toBe(72)
  })
})

// ── DELETE /api/readings/:readingId ──────────────────────────────────────────

describe('DELETE /api/readings/:readingId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the reading does not exist', async () => {
    vi.mocked(prisma.reading.findUnique).mockResolvedValue(null)

    const res = await DELETE(
      new Request('http://localhost/api/readings/missing-id'),
      { params: Promise.resolve({ readingId: 'missing-id' }) }
    )
    expect(res.status).toBe(404)
  })

  it('deletes the reading and returns ok', async () => {
    const mockReading = { id: 'r-1', deviceId: 'dev-1', soilMoisture: 42 }
    vi.mocked(prisma.reading.findUnique).mockResolvedValue(mockReading as any)
    vi.mocked(prisma.reading.delete).mockResolvedValue(mockReading as any)

    const res = await DELETE(
      new Request('http://localhost/api/readings/r-1'),
      { params: Promise.resolve({ readingId: 'r-1' }) }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('calls prisma.reading.delete with the correct id', async () => {
    const mockReading = { id: 'r-42', deviceId: 'dev-1', soilMoisture: 55 }
    vi.mocked(prisma.reading.findUnique).mockResolvedValue(mockReading as any)
    vi.mocked(prisma.reading.delete).mockResolvedValue(mockReading as any)

    await DELETE(
      new Request('http://localhost/api/readings/r-42'),
      { params: Promise.resolve({ readingId: 'r-42' }) }
    )

    expect(prisma.reading.delete).toHaveBeenCalledWith({ where: { id: 'r-42' } })
  })
})
