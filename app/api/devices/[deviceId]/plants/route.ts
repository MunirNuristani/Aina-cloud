import { prisma } from '@/lib/prisma'
import { CreatePlantSchema } from '@/lib/validators'

export async function POST(
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

  const parsed = CreatePlantSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, type, targetMinMoisture, targetMaxMoisture } = parsed.data

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) {
      return Response.json({ error: 'Device not found' }, { status: 404 })
    }

    const plant = await prisma.plant.create({
      data: { deviceId, name, type, targetMinMoisture, targetMaxMoisture },
    })

    return Response.json({ ok: true, plant }, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
