import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    
    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
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

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${apiKey}`
    )

    if (!response.ok) {
      throw new Error('Failed to geocode address')
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return NextResponse.json(
        { error: "No location found for this address" },
        { status: 404 }
      )
    }

    const { lat, lng } = data.results[0].geometry.location
    return NextResponse.json({ latitude: lat, longitude: lng })

  } catch (error) {
    console.error('Error geocoding address:', error)
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    )
  }
}