import { z } from 'zod'

export const CreateReadingSchema = z.object({
  deviceId: z.string().min(1),
  plantId: z.string().min(1).optional(),
  soilMoisture: z.number().int().min(0).max(100),
  rawMoisture: z.number().int().min(0),
  pumpState: z.boolean(),
  watered: z.boolean(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  light: z.number().optional(),
  airQuality: z.number().optional(),
})

export const CreatePumpCommandSchema = z.object({
  deviceId: z.string().min(1),
  durationMs: z.number().int().min(1000).max(10000),
})

export const CommandResultSchema = z.object({
  status: z.enum(['completed', 'rejected', 'failed']),
  reason: z.string().optional(),
})

export const RegisterDeviceSchema = z.object({
  name: z.string().min(1),
  locationLat: z.number().optional(),
  locationLon: z.number().optional(),
  locationName: z.string().optional(),
})

export const PatchDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  locationLat: z.number().nullable().optional(),
  locationLon: z.number().nullable().optional(),
  locationName: z.string().nullable().optional(),
})

export const CreatePlantSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  targetMinMoisture: z.number().int().min(0).max(100).optional(),
  targetMaxMoisture: z.number().int().min(0).max(100).optional(),
})

export type CreateReadingInput = z.infer<typeof CreateReadingSchema>
export type CreatePumpCommandInput = z.infer<typeof CreatePumpCommandSchema>
export type CommandResultInput = z.infer<typeof CommandResultSchema>
export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>
export type PatchDeviceInput = z.infer<typeof PatchDeviceSchema>
export type CreatePlantInput = z.infer<typeof CreatePlantSchema>
