import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentWeather } from '@/lib/weather'

describe('getCurrentWeather', () => {
  beforeEach(() => {
    vi.stubEnv('OPENWEATHER_API_KEY', 'test-key-123')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns null when OPENWEATHER_API_KEY is not set', async () => {
    vi.unstubAllEnvs() // clear the key set in beforeEach
    const result = await getCurrentWeather(37.77, -122.41)
    expect(result).toBeNull()
  })

  it('returns a WeatherData object on a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        main: { temp: 72.5, humidity: 60, pressure: 1013 },
        weather: [{ description: 'clear sky' }],
      }),
    }))

    const result = await getCurrentWeather(37.77, -122.41)

    expect(result).toEqual({
      weatherTemp: 72.5,
      weatherHumidity: 60,
      weatherPressure: 1013,
      weatherDescription: 'clear sky',
    })
  })

  it('includes lat/lon in the fetch URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        main: { temp: 70, humidity: 55, pressure: 1010 },
        weather: [{ description: 'cloudy' }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await getCurrentWeather(51.5, -0.13)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('lat=51.5')
    expect(calledUrl).toContain('lon=-0.13')
  })

  it('returns null when fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await getCurrentWeather(37.77, -122.41)
    expect(result).toBeNull()
  })

  it('returns null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    const result = await getCurrentWeather(37.77, -122.41)
    expect(result).toBeNull()
  })

  it('returns empty string for weatherDescription when weather array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        main: { temp: 70, humidity: 55, pressure: 1010 },
        weather: [],
      }),
    }))

    const result = await getCurrentWeather(37.77, -122.41)
    expect(result?.weatherDescription).toBe('')
  })
})
