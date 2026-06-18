import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks must be declared before imports that use them
vi.mock('@/lib/prisma', () => ({
  prisma: {
    device: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}))

import { authenticateDevice } from '@/lib/auth-device'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'

const mockDevice = {
  id: 'dev-1',
  name: 'Test Device',
  apiKeyHash: '$2b$12$hashedkeyvalue',
  locationLat: null,
  locationLon: null,
  locationName: null,
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function makeRequest(deviceId?: string, deviceKey?: string): Request {
  const headers = new Headers()
  if (deviceId !== undefined) headers.set('x-device-id', deviceId)
  if (deviceKey !== undefined) headers.set('x-device-key', deviceKey)
  return new Request('http://localhost/api/readings', { method: 'POST', headers })
}

describe('authenticateDevice', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns 401 when both headers are missing', async () => {
    const result = await authenticateDevice(makeRequest())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when x-device-key is missing', async () => {
    const result = await authenticateDevice(makeRequest('dev-1'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when x-device-id is missing', async () => {
    const result = await authenticateDevice(makeRequest(undefined, 'some-key'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when device is not found', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(null)
    const result = await authenticateDevice(makeRequest('dev-999', 'some-key'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when key does not match', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(compare).mockResolvedValue(false as never)
    const result = await authenticateDevice(makeRequest('dev-1', 'wrong-key'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns ok with device when credentials are correct', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(compare).mockResolvedValue(true as never)
    const result = await authenticateDevice(makeRequest('dev-1', 'correct-key'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.device.id).toBe('dev-1')
  })

  it('appends the pepper to the key before comparing', async () => {
    vi.stubEnv('DEVICE_API_KEY_PEPPER', 'my-secret-pepper')
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)
    vi.mocked(compare).mockResolvedValue(true as never)

    await authenticateDevice(makeRequest('dev-1', 'plain-key'))

    expect(compare).toHaveBeenCalledWith('plain-keymy-secret-pepper', mockDevice.apiKeyHash)
  })

  it('bypasses bcrypt when DEV_BYPASS_AUTH=true in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('DEV_BYPASS_AUTH', 'true')
    vi.mocked(prisma.device.findUnique).mockResolvedValue(mockDevice as any)

    const result = await authenticateDevice(makeRequest('dev-1', 'any-key'))
    expect(result.ok).toBe(true)
    expect(compare).not.toHaveBeenCalled()
  })
})
