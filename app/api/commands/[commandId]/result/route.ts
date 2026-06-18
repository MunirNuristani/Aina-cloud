import { authenticateDevice } from '@/lib/auth-device'
import { prisma } from '@/lib/prisma'
import { CommandResultSchema } from '@/lib/validators'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commandId: string }> }
) {
  const auth = await authenticateDevice(request)
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  const { commandId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CommandResultSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { status, reason } = parsed.data

  try {
    const command = await prisma.pumpCommand.findUnique({ where: { id: commandId } })
    if (!command) {
      return Response.json({ error: 'Command not found' }, { status: 404 })
    }

    if (command.deviceId !== auth.device.id) {
      return Response.json({ error: 'Device mismatch' }, { status: 403 })
    }

    const now = new Date()
    const updated = await prisma.pumpCommand.update({
      where: { id: commandId },
      data: {
        status,
        reason,
        completedAt: status === 'completed' ? now : undefined,
        failedAt: status === 'failed' || status === 'rejected' ? now : undefined,
      },
    })

    return Response.json({ ok: true, command: updated })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
