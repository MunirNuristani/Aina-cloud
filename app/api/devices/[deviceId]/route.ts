import { prisma } from '@/lib/prisma'
import { PatchDeviceSchema } from '@/lib/validators'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchDeviceSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) {
      return Response.json({ error: 'Device not found' }, { status: 404 })
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: parsed.data,
    })

    return Response.json({ ok: true, device: updated })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
