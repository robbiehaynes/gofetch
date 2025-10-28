import { NextResponse } from 'next/server'

interface TrainService {
  scheduledAt: string
  estimatedAt: string
  station: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const stationCode = searchParams.get('station')
  const stationName = searchParams.get('stationName')
  const trainId = searchParams.get('trainId')

  if (!stationCode || !trainId) {
    return NextResponse.json({ error: 'Station code and train ID are required' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://www.thetrainline.com/live/api/trains;action=details;isDepartures=false;selectedStationCode=${stationCode};serviceId=${trainId}?returnMeta=true`,
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

    const filteredPoints = data.data.callingPoints.filter((point: TrainService) => 
      point.station.toLowerCase() === stationName?.toLowerCase()
    )

    const returnData : TrainService = {
      scheduledAt: filteredPoints[0]?.scheduledAt,
      estimatedAt: filteredPoints[0]?.estimatedAt === "On time" ? filteredPoints[0]?.scheduledAt : filteredPoints[0]?.estimatedAt,
      station: filteredPoints[0]?.station
    }

    return NextResponse.json(returnData)
  } catch (error) {
    console.error('Error fetching train data:', error)
    return NextResponse.json({ error: 'Failed to fetch train data' }, { status: 500 })
  }
}