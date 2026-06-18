import { authenticateDevice } from '@/lib/auth-device'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const auth = await authenticateDevice(request)
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { deviceId } = await params

  if (deviceId !== auth.device.id) {
    return Response.json({ error: 'Device mismatch' }, { status: 403 })
  }

  try {
    const command = await prisma.pumpCommand.findFirst({
      where: { deviceId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })

    if (!command) {
      return Response.json({ command: null })
    }

    await prisma.pumpCommand.update({
      where: { id: command.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    })

    return Response.json({ command: { id: command.id, durationMs: command.durationMs } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
