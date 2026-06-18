import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params

  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    })
    if (!device) {
      return Response.json({ error: 'Device not found' }, { status: 404 })
    }

    const latestReading = await prisma.reading.findFirst({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    })

    const plant = latestReading?.plantId
      ? await prisma.plant.findUnique({ where: { id: latestReading.plantId } })
      : null

    return Response.json({ device, plant, latestReading })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
