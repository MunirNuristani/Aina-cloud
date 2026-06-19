import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../app/generated/prisma/client'
import { hash } from 'bcryptjs'
import { randomBytes } from 'crypto'

const pool = new Pool({ connectionString: process.env.POSTGRES_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const plainKey = randomBytes(24).toString('hex')
  const pepper = process.env.DEVICE_API_KEY_PEPPER ?? ''
  const apiKeyHash = await hash(plainKey + pepper, 12)

  const device = await prisma.device.upsert({
    where: { id: 'esp32-plant-001' },
    update: {},
    create: {
      id: 'esp32-plant-001',
      name: 'ESP32 Plant Monitor 001',
      apiKeyHash,
    },
  })

  const plant = await prisma.plant.upsert({
    where: { id: 'plant-001' },
    update: {},
    create: {
      id: 'plant-001',
      deviceId: device.id,
      name: 'Rosemary',
      type: 'Herb',
      targetMinMoisture: 35,
      targetMaxMoisture: 70,
    },
  })

  console.log('Seeded device:', device.id, device.name)
  console.log('Seeded plant:', plant.id, plant.name)
  console.log('\n--- SAVE THIS KEY (printed once) ---')
  console.log('Device API key:', plainKey)
  console.log('Use this in your ESP32 as x-device-key header.')
  console.log('---')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
