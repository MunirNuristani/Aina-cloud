import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { Device } from '@/app/generated/prisma/client'

export type AuthResult =
  | { ok: true; device: Device }
  | { ok: false; status: 401 | 403; message: string }

export async function authenticateDevice(request: Request): Promise<AuthResult> {
  const deviceId = request.headers.get('x-device-id')
  const deviceKey = request.headers.get('x-device-key')

  if (!deviceId || !deviceKey) {
    return { ok: false, status: 401, message: 'Missing x-device-id or x-device-key' }
  }

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) return { ok: false, status: 401, message: 'Device not found' }
    return { ok: true, device }
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } })
  if (!device) {
    return { ok: false, status: 401, message: 'Invalid credentials' }
  }

  const pepper = process.env.DEVICE_API_KEY_PEPPER ?? ''
  const valid = await compare(deviceKey + pepper, device.apiKeyHash)
  if (!valid) {
    return { ok: false, status: 401, message: 'Invalid credentials' }
  }

  return { ok: true, device }
}
