import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const plants = await prisma.plant.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return Response.json({ plants })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
