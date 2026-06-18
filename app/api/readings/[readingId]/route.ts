import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ readingId: string }> }
) {
  const { readingId } = await params

  try {
    const reading = await prisma.reading.findUnique({ where: { id: readingId } })
    if (!reading) {
      return Response.json({ error: 'Reading not found' }, { status: 404 })
    }

    await prisma.reading.delete({ where: { id: readingId } })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
