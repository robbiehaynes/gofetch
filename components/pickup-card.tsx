"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plane, Train, MapPin } from "lucide-react"
import { MapDirectionsButton } from "@/components/maps-direction-button"

interface Coordinates {
  latitude: number
  longitude: number
}

interface PickupCardProps {
  pickup: {
    id: string
    type: "flight" | "train"
    location: string
    locationCode: string
    locationCoords: Coordinates
    scheduledArrival: number
    currentDelay: number
    userCoords: Coordinates
    travelTime: number
    buffer: number
    passengerName?: string
    origin?: string
    platform?: string
    operator?: string
  }
  isActive: boolean
  settings: {
    notificationsEnabled: boolean
    updateFrequency: number
    localOnlyMode: boolean
  }
  onBufferUpdate: (pickupId: string, newBuffer: number) => void
  lastUpdated: Date | null
  isUpdating: boolean
}

export function PickupCard({ pickup, isActive, settings, onBufferUpdate, lastUpdated, isUpdating }: PickupCardProps) {
  const [departureTime, setDepartureTime] = useState<number | null>(null)
  const [timeUntilDeparture, setTimeUntilDeparture] = useState<number | null>(null)
  const [notificationShown, setNotificationShown] = useState(false)
  const [isEditingBuffer, setIsEditingBuffer] = useState(false)
  const [bufferInput, setBufferInput] = useState("")

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

  const getLastUpdatedText = () => {
    if (isUpdating) return "Updating..."
    if (!lastUpdated) return ""
    const diffMs = Date.now() - lastUpdated.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Last Updated: Now"
    return `Last Updated: ${diffMin} min ago`
  }

  const handleUpdateBuffer = () => {
    if (!bufferInput) return
    const newBuffer = parseInt(bufferInput)
    if (isNaN(newBuffer) || newBuffer < 0) return
    onBufferUpdate(pickup.id, newBuffer)
    setIsEditingBuffer(false)
  }

  // Combined time calculations and countdown effect (only when active)
  useEffect(() => {
    if (!isActive) return

    // Reset states when pickup becomes active
    setNotificationShown(false)
    
    // Calculate departure time
    const calculateDepartureTime = () => {
      const adjustedArrival = pickup.scheduledArrival + pickup.currentDelay * 60000
      return adjustedArrival - pickup.travelTime * 60000 - pickup.buffer * 60000
    }

    // Update countdown
    const updateCountdown = () => {
      const departureTime = calculateDepartureTime()
      setDepartureTime(departureTime)
      
      const now = Date.now()
      const timeLeft = departureTime - now

      if (timeLeft <= 0) {
        setTimeUntilDeparture(0)
        // Only show notification if we haven't shown it yet and notifications are enabled
        if (!notificationShown && settings.notificationsEnabled) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("GoFetch", {
              body: `Leave now to arrive ${pickup.buffer} minutes before the ${new Date(pickup.scheduledArrival).toLocaleTimeString()} train from ${pickup.origin} gets in at ${pickup.location}`,
              icon: "/car-driving.webp",
            })
            // Mark notification as shown immediately after showing it
            setNotificationShown(true)
          }
        }
      } else {
        setTimeUntilDeparture(timeLeft)
      }
    }

    // Initial countdown update
    updateCountdown()

    // Set up interval for countdown updates
    const countdownInterval = setInterval(updateCountdown, 1000)

    return () => clearInterval(countdownInterval)
  }, [isActive, pickup, settings.notificationsEnabled])

  const isTimeToLeave = timeUntilDeparture !== null && timeUntilDeparture <= 0

  return (
    <Card
      className={`my-4 p-6 rounded-xl border-0 ${isTimeToLeave ? "bg-gradient-to-br from-red-50 to-orange-50" : "bg-gradient-to-br from-blue-50 to-indigo-50"}`}
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

      {/* Status Info - Only show when active */}
      {isActive && (
        <div className="mt-6 pt-6 border-t-2 border-gray-200 space-y-4">
          {pickup.currentDelay > 0 && (
            <div className="pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Current Delay</p>
              <p className="text-2xl font-bold text-gray-900">
                {pickup.currentDelay > 0 ? `+${pickup.currentDelay}` : pickup.currentDelay} min
              </p>
            </div>
          )}
          
          <div className="pb-4 border-b border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Live Travel Time</p>
            <p className="text-lg font-semibold text-gray-900 mb-2">{pickup.travelTime} minutes</p>
            <MapDirectionsButton
              origin={pickup.userCoords}
              destination={pickup.locationCoords}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Safety Buffer</p>
                {isEditingBuffer ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={bufferInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferInput(e.target.value)}
                      className="w-20 h-8"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          handleUpdateBuffer()
                        }
                        if (e.key === 'Escape') {
                          setIsEditingBuffer(false)
                        }
                      }}
                    />
                    <span className="text-sm text-gray-600">minutes</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-gray-900">{pickup.buffer} minutes</p>
                )}
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!isEditingBuffer) {
                      setBufferInput(pickup.buffer.toString())
                    }
                    setIsEditingBuffer(!isEditingBuffer)
                  }}
                >
                  {isEditingBuffer ? "Cancel" : "Edit"}
                </Button>
                {isEditingBuffer && (
                  <Button
                    variant="default"
                    className="ml-2"
                    size="sm"
                    onClick={handleUpdateBuffer}
                  >
                    Save
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500 text-wrap">This buffer is added to ensure you arrive early. Adjust as needed.</p>
            </div>
          </div>

          <div className="w-full flex justify-center pt-2">
            <span className="text-xs text-gray-500">{getLastUpdatedText()}</span>
          </div>
        </div>
      )}
    </Card>
  )
}
