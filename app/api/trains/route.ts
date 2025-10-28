import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const stationCode = searchParams.get('station')

  if (!stationCode) {
    return NextResponse.json({ error: 'Station code is required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://www.thetrainline.com/live/api/trains;action=arrivals;destinationCode=;originCode=${stationCode}?returnMeta=true`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GoFetch/1.0;)',
          'Accept': 'application/json',
          'Origin': 'https://www.thetrainline.com',
          'Referer': 'https://www.thetrainline.com/'
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch train data')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching train data:', error)
    return NextResponse.json({ error: 'Failed to fetch train data' }, { status: 500 })
  }
}