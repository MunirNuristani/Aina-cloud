import { authenticateDevice } from '@/lib/auth-device'
import { getCurrentWeather } from '@/lib/weather'
import { prisma } from '@/lib/prisma'
import { CreateReadingSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const auth = await authenticateDevice(request)
  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateReadingSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  if (data.deviceId !== auth.device.id) {
    return Response.json({ error: 'Device mismatch' }, { status: 403 })
  }

  const weather =
    await getCurrentWeather(37.7035, -122.1197)
     
  try {
    const [reading] = await prisma.$transaction([
      prisma.reading.create({
        data: {
          deviceId: data.deviceId,
          plantId: data.plantId,
          soilMoisture: data.soilMoisture,
          rawMoisture: data.rawMoisture,
          pumpState: data.pumpState,
          watered: data.watered,
          temperature: data.temperature,
          humidity: data.humidity,
          light: data.light,
          airQuality: data.airQuality,
          ...(weather ?? {}),
        },
      }),
      prisma.device.update({
        where: { id: data.deviceId },
        data: { lastSeenAt: new Date() },
      }),
    ])

    return Response.json({ ok: true, reading: { id: reading.id, soilMoisture: reading.soilMoisture, createdAt: reading.createdAt, weather: weather } })
  } catch (e) {
    console.error('[readings] prisma error:', e)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
