import { NextResponse } from 'next/server'

interface LatLng {
  latitude: number
  longitude: number
}

interface Location {
  location: {
    latLng: LatLng
  }
}

interface RouteRequest {
  origin: LatLng
  destination: LatLng
}

export async function POST(request: Request) {
  try {
    const { origin, destination }: RouteRequest = await request.json()

    // Validate required data
    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origin and destination coordinates are required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key is not configured" },
        { status: 500 }
      )
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration'
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: origin
          }
        },
        destination: {
          location: {
            latLng: destination
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false
        },
        languageCode: "en-UK",
        units: "METRIC"
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: "Failed to fetch route", details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // The API returns duration in seconds, let's convert it to minutes
    const durationInMinutes = Math.ceil(parseInt(data.routes[0].duration.slice(0, -1)) / 60)
    
    return NextResponse.json({ duration: durationInMinutes })

  } catch (error) {
    console.error('Error calculating route:', error)
    return NextResponse.json(
      { error: "Failed to calculate route" },
      { status: 500 }
    )
  }
}
