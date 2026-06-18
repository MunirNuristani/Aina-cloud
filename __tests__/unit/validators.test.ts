import { describe, it, expect } from 'vitest'
import {
  CreateReadingSchema,
  RegisterDeviceSchema,
  PatchDeviceSchema,
  CreatePlantSchema,
  CreatePumpCommandSchema,
  CommandResultSchema,
} from '@/lib/validators'

// ── CreateReadingSchema ──────────────────────────────────────────────────────

describe('CreateReadingSchema', () => {
  const valid = {
    deviceId: 'dev-1',
    soilMoisture: 42,
    rawMoisture: 2100,
    pumpState: false,
    watered: false,
  }

  it('accepts a minimal valid reading', () => {
    expect(CreateReadingSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts all optional sensor fields', () => {
    const result = CreateReadingSchema.safeParse({
      ...valid,
      plantId: 'plant-1',
      temperature: 22.5,
      humidity: 58.0,
      light: 300,
      airQuality: 95,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing deviceId', () => {
    const { deviceId: _removed, ...rest } = valid
    expect(CreateReadingSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty deviceId', () => {
    expect(CreateReadingSchema.safeParse({ ...valid, deviceId: '' }).success).toBe(false)
  })

  it('rejects soilMoisture > 100', () => {
    expect(CreateReadingSchema.safeParse({ ...valid, soilMoisture: 101 }).success).toBe(false)
  })

  it('rejects soilMoisture < 0', () => {
    expect(CreateReadingSchema.safeParse({ ...valid, soilMoisture: -1 }).success).toBe(false)
  })

  it('rejects non-integer soilMoisture', () => {
    expect(CreateReadingSchema.safeParse({ ...valid, soilMoisture: 42.5 }).success).toBe(false)
  })

  it('rejects non-boolean pumpState', () => {
    expect(CreateReadingSchema.safeParse({ ...valid, pumpState: 1 }).success).toBe(false)
  })

  it('rejects missing rawMoisture', () => {
    const { rawMoisture: _removed, ...rest } = valid
    expect(CreateReadingSchema.safeParse(rest).success).toBe(false)
  })
})

// ── RegisterDeviceSchema ─────────────────────────────────────────────────────

describe('RegisterDeviceSchema', () => {
  it('accepts name only', () => {
    expect(RegisterDeviceSchema.safeParse({ name: 'My Plant' }).success).toBe(true)
  })

  it('accepts all fields', () => {
    expect(RegisterDeviceSchema.safeParse({
      name: 'My Plant',
      locationLat: 37.77,
      locationLon: -122.41,
      locationName: 'Living Room',
    }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(RegisterDeviceSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects missing name', () => {
    expect(RegisterDeviceSchema.safeParse({}).success).toBe(false)
  })
})

// ── PatchDeviceSchema ────────────────────────────────────────────────────────

describe('PatchDeviceSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(PatchDeviceSchema.safeParse({}).success).toBe(true)
  })

  it('accepts null values to clear location', () => {
    expect(PatchDeviceSchema.safeParse({
      locationLat: null,
      locationLon: null,
      locationName: null,
    }).success).toBe(true)
  })

  it('accepts a name update', () => {
    expect(PatchDeviceSchema.safeParse({ name: 'New Name' }).success).toBe(true)
  })

  it('rejects empty name string', () => {
    expect(PatchDeviceSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

// ── CreatePlantSchema ────────────────────────────────────────────────────────

describe('CreatePlantSchema', () => {
  it('accepts name only', () => {
    expect(CreatePlantSchema.safeParse({ name: 'Basil' }).success).toBe(true)
  })

  it('accepts all optional fields', () => {
    expect(CreatePlantSchema.safeParse({
      name: 'Basil',
      type: 'Herb',
      targetMinMoisture: 40,
      targetMaxMoisture: 75,
    }).success).toBe(true)
  })

  it('rejects missing name', () => {
    expect(CreatePlantSchema.safeParse({}).success).toBe(false)
  })

  it('rejects targetMinMoisture above 100', () => {
    expect(CreatePlantSchema.safeParse({ name: 'X', targetMinMoisture: 101 }).success).toBe(false)
  })

  it('rejects targetMaxMoisture below 0', () => {
    expect(CreatePlantSchema.safeParse({ name: 'X', targetMaxMoisture: -1 }).success).toBe(false)
  })

  it('rejects non-integer moisture targets', () => {
    expect(CreatePlantSchema.safeParse({ name: 'X', targetMinMoisture: 40.5 }).success).toBe(false)
  })
})

// ── CreatePumpCommandSchema ──────────────────────────────────────────────────

describe('CreatePumpCommandSchema', () => {
  it('accepts a valid command', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 3000 }).success).toBe(true)
  })

  it('accepts durationMs at minimum boundary (1000)', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 1000 }).success).toBe(true)
  })

  it('accepts durationMs at maximum boundary (10000)', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 10000 }).success).toBe(true)
  })

  it('rejects durationMs below minimum', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 999 }).success).toBe(false)
  })

  it('rejects durationMs above maximum', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 10001 }).success).toBe(false)
  })

  it('rejects missing deviceId', () => {
    expect(CreatePumpCommandSchema.safeParse({ durationMs: 3000 }).success).toBe(false)
  })

  it('rejects non-integer durationMs', () => {
    expect(CreatePumpCommandSchema.safeParse({ deviceId: 'dev-1', durationMs: 3000.5 }).success).toBe(false)
  })
})

// ── CommandResultSchema ──────────────────────────────────────────────────────

describe('CommandResultSchema', () => {
  it.each(['completed', 'rejected', 'failed'] as const)('accepts status "%s"', (status) => {
    expect(CommandResultSchema.safeParse({ status }).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(CommandResultSchema.safeParse({ status: 'unknown' }).success).toBe(false)
  })

  it('accepts an optional reason string', () => {
    expect(CommandResultSchema.safeParse({ status: 'failed', reason: 'valve stuck' }).success).toBe(true)
  })

  it('rejects missing status', () => {
    expect(CommandResultSchema.safeParse({}).success).toBe(false)
  })
})
