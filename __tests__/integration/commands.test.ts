import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    device: { findUnique: vi.fn() },
    pumpCommand: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth-device', () => ({
  authenticateDevice: vi.fn(),
}))

import { POST } from '@/app/api/commands/route'
import { POST as reportResult } from '@/app/api/commands/[commandId]/result/route'
import { prisma } from '@/lib/prisma'
import { authenticateDevice } from '@/lib/auth-device'

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

const mockCommand = {
  id: 'cmd-1',
  deviceId: 'dev-1',
  durationMs: 3000,
  status: 'pending',
  reason: null,
  createdAt: new Date(),
  acceptedAt: null,
  completedAt: null,
  failedAt: null,
}

function makeCommandRequest(body: unknown) {
  return new Request('http://localhost/api/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeResultRequest(body: unknown, deviceId = 'dev-1') {
  return new Request('http://localhost/api/commands/cmd-1/result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      'x-device-key': 'some-key',
    },
    body: JSON.stringify(body),
  })
}

// ── POST /api/commands ───────────────────────────────────────────────────────

describe('POST /api/commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a pump command and returns it', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(prisma.pumpCommand.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.pumpCommand.create).mockResolvedValue(mockCommand as any)

    const res = await POST(makeCommandRequest({ deviceId: 'dev-1', durationMs: 3000 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.command.id).toBe('cmd-1')
    expect(body.command.durationMs).toBe(3000)
  })

  it('returns 409 when a pending command already exists', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(prisma.pumpCommand.findFirst).mockResolvedValue(mockCommand as any)

    const res = await POST(makeCommandRequest({ deviceId: 'dev-1', durationMs: 3000 }))
    expect(res.status).toBe(409)
  })

  it('returns 404 when the device does not exist', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(null)

    const res = await POST(makeCommandRequest({ deviceId: 'unknown-dev', durationMs: 3000 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when durationMs is below minimum (1000)', async () => {
    const res = await POST(makeCommandRequest({ deviceId: 'dev-1', durationMs: 999 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when durationMs is above maximum (10000)', async () => {
    const res = await POST(makeCommandRequest({ deviceId: 'dev-1', durationMs: 10001 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when deviceId is missing', async () => {
    const res = await POST(makeCommandRequest({ durationMs: 3000 }))
    expect(res.status).toBe(400)
  })
})

// ── POST /api/commands/:commandId/result ─────────────────────────────────────

describe('POST /api/commands/:commandId/result', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when auth fails', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: false, status: 401, message: 'Bad auth' })

    const res = await reportResult(makeResultRequest({ status: 'completed' }), {
      params: Promise.resolve({ commandId: 'cmd-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 404 when the command does not exist', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })
    vi.mocked(prisma.pumpCommand.findUnique).mockResolvedValue(null)

    const res = await reportResult(makeResultRequest({ status: 'completed' }), {
      params: Promise.resolve({ commandId: 'missing-cmd' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 403 when the command belongs to a different device', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })
    vi.mocked(prisma.pumpCommand.findUnique).mockResolvedValue({
      ...mockCommand, deviceId: 'other-device',
    } as any)

    const res = await reportResult(makeResultRequest({ status: 'completed' }), {
      params: Promise.resolve({ commandId: 'cmd-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('marks the command as completed', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })
    vi.mocked(prisma.pumpCommand.findUnique).mockResolvedValue(mockCommand as any)
    vi.mocked(prisma.pumpCommand.update).mockResolvedValue({ ...mockCommand, status: 'completed' } as any)

    const res = await reportResult(makeResultRequest({ status: 'completed' }), {
      params: Promise.resolve({ commandId: 'cmd-1' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.command.status).toBe('completed')
  })

  it.each(['completed', 'failed', 'rejected'] as const)(
    'accepts status "%s"',
    async (status) => {
      vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })
      vi.mocked(prisma.pumpCommand.findUnique).mockResolvedValue(mockCommand as any)
      vi.mocked(prisma.pumpCommand.update).mockResolvedValue({ ...mockCommand, status } as any)

      const res = await reportResult(makeResultRequest({ status }), {
        params: Promise.resolve({ commandId: 'cmd-1' }),
      })
      expect(res.status).toBe(200)
    }
  )

  it('returns 400 for an unknown status', async () => {
    vi.mocked(authenticateDevice).mockResolvedValue({ ok: true, device: mockDevice as any })

    const res = await reportResult(makeResultRequest({ status: 'hacked' }), {
      params: Promise.resolve({ commandId: 'cmd-1' }),
    })
    expect(res.status).toBe(400)
  })
})
