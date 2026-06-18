import { prisma } from '@/lib/prisma'
import { CreatePumpCommandSchema } from '@/lib/validators'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreatePumpCommandSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { deviceId, durationMs } = parsed.data

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) {
      return Response.json({ error: 'Device not found' }, { status: 404 })
    }

    const existing = await prisma.pumpCommand.findFirst({
      where: { deviceId, status: 'pending' },
    })
    if (existing) {
      return Response.json({ error: 'A pending command already exists for this device' }, { status: 409 })
    }

    const command = await prisma.pumpCommand.create({
      data: { deviceId, durationMs, status: 'pending' },
    })

    return Response.json({ ok: true, command })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
