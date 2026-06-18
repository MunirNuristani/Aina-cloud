import { prisma } from '@/lib/prisma'
import { RegisterDeviceSchema } from '@/lib/validators'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function GET() {
  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'asc' } })
  return Response.json({ devices })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = RegisterDeviceSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, locationLat, locationLon, locationName } = parsed.data

  const plainKey = randomBytes(24).toString('hex')
  const pepper = process.env.DEVICE_API_KEY_PEPPER ?? ''
  const apiKeyHash = await hash(plainKey + pepper, 12)

  try {
    const device = await prisma.device.create({
      data: { name, apiKeyHash, locationLat, locationLon, locationName },
    })

    return Response.json(
      { ok: true, deviceId: device.id, apiKey: plainKey },
      { status: 201 }
    )
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
