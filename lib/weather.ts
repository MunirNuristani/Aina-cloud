export interface WeatherData {
  weatherTemp: number
  weatherHumidity: number
  weatherDescription: string
  weatherPressure: number
}

export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return null

    const data = await res.json()
    return {
      weatherTemp: data.main.temp,
      weatherHumidity: data.main.humidity,
      weatherPressure: data.main.pressure,
      weatherDescription: data.weather?.[0]?.description ?? '',
    }
  } catch {
    return null
  }
}
