import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)

  try {
    const readings = await prisma.reading.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return Response.json({ readings })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
