"use client"

import { Card } from "@/components/ui/card"
import { Plane, Train, MapPin } from "lucide-react"

interface PickupCardProps {
  pickup: {
    type: "flight" | "train"
    location: string
    scheduledArrival: number
    currentDelay: number
    passengerName?: string
    origin?: string,
    platform?: string
    operator?: string
  }
  departureTime: number | null
  timeUntilDeparture: number | null
}

export function PickupCard({ pickup, departureTime, timeUntilDeparture }: PickupCardProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m ${seconds}s`
  }

  const formatTimeOfDay = (ms: number) => {
    const date = new Date(ms)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  const isTimeToLeave = timeUntilDeparture !== null && timeUntilDeparture <= 0

  return (
    <Card
      className={`mt-4 p-6 rounded-t-xl rounded-b-none border-0 shadow-lg ${isTimeToLeave ? "bg-gradient-to-br from-red-50 to-orange-50" : "bg-gradient-to-br from-blue-50 to-indigo-50"}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {pickup.type === "flight" ? (
            <Plane className={`w-8 h-8 ${isTimeToLeave ? "text-red-600" : "text-blue-600"}`} />
          ) : (
            <Train className={`w-8 h-8 ${isTimeToLeave ? "text-red-600" : "text-blue-600"}`} />
          )}
          <div>
            <p className="text-sm text-gray-600">{pickup.type === "flight" ? "Flight" : `${pickup.operator} train`} from</p>
            <p className="text-2xl font-bold text-gray-900">{pickup.origin}</p>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 mb-6 pb-6 border-b border-gray-200">
        <MapPin className="w-5 h-5 text-gray-600" />
        <div>
          <p className="text-sm text-gray-600">Pickup Location</p>
          <p className="font-semibold text-gray-900">{pickup.location}</p>
          <p className="text-sm text-gray-600">Platform {pickup.platform === null ? "N/A" : pickup.platform}</p>
        </div>
      </div>

      {/* Passenger Name */}
      {pickup.passengerName && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Passenger</p>
          <p className="font-semibold text-gray-900">{pickup.passengerName}</p>
        </div>
      )}

      {/* Arrival Time */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <p className="text-md font-bold text-gray-600 mb-2">Arrival Information</p>
        <div className="flex items-baseline gap-10">
          <div>
            <p className="text-sm text-gray-500 mb-1">Scheduled</p>
            <p className="text-lg font-semibold text-gray-900">{formatTimeOfDay(pickup.scheduledArrival)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Expected</p>
            {pickup.currentDelay === 0 ? (
              <p className="text-lg font-semibold text-green-600">On time</p>
            ) : (
              <p className="text-lg font-semibold text-orange-600">
                {formatTimeOfDay(pickup.scheduledArrival + (pickup.currentDelay * 60000))}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Departure Time - Main CTA */}
      <div
        className={`p-4 rounded-lg ${isTimeToLeave ? "bg-red-100 border-2 border-red-600" : "bg-white border-2 border-blue-200"}`}
      >
        <p className="text-sm text-gray-600 mb-2">Leave at</p>
        <p className={`text-3xl font-bold ${isTimeToLeave ? "text-red-600" : "text-blue-600"}`}>
          {departureTime ? formatTimeOfDay(departureTime) : "--:--"}
        </p>
        {isTimeToLeave && <p className="text-sm text-red-600 font-semibold mt-2">🚗 Leave Now!</p>}
      </div>

      {/* Countdown */}
      {timeUntilDeparture !== null && timeUntilDeparture > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Time until departure</p>
          <p className="text-2xl font-bold text-blue-600">{formatTime(timeUntilDeparture)}</p>
        </div>
      )}
    </Card>
  )
}
