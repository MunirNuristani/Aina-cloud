import { prisma } from '@/lib/prisma'

async function getStatus() {
  try {
    const deviceCount = await prisma.device.count()
    return { ok: true, deviceCount }
  } catch {
    return { ok: false, deviceCount: 0 }
  }
}

export default async function Home() {
  const { ok, deviceCount } = await getStatus()

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>Aina Cloud API</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Self-hosted plant monitoring backend</p>

      <h2>Status</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ padding: '0.4rem 0.8rem 0.4rem 0', color: '#666' }}>App</td>
            <td style={{ color: 'green' }}>✓ running</td>
          </tr>
          <tr>
            <td style={{ padding: '0.4rem 0.8rem 0.4rem 0', color: '#666' }}>Database</td>
            <td style={{ color: ok ? 'green' : 'red' }}>
              {ok ? `✓ connected · ${deviceCount} device${deviceCount !== 1 ? 's' : ''}` : '✗ unreachable — check DATABASE_URL'}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>API Endpoints</h2>
      <ul style={{ lineHeight: '2' }}>
        <li><a href="/api/devices">GET /api/devices</a></li>
        <li>POST /api/devices</li>
        <li>POST /api/readings</li>
        <li>POST /api/commands</li>
        <li>GET /api/plants</li>
      </ul>
    </div>
  )
}

