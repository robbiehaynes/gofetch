"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Plane, Train, MapPin, Pin, Check } from "lucide-react"
import { MapDirectionsButton } from "@/components/maps-direction-button"
import PlacesAutocomplete from "@/components/autocomplete-input"
import AllStationsJSON from "uk-railway-stations"

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
    locationCoords?: Coordinates
    scheduledArrival?: number
    currentDelay?: number
    userCoords?: Coordinates
    travelTime?: number
    buffer?: number
    origin?: string
    platform?: string
    operator?: string
  }
  isActive: boolean
  settings: {
    updateFrequency: number
    localOnlyMode: boolean
  }
  onBufferUpdate: (pickupId: string, newBuffer: number) => void
  onLocationUpdate?: (pickupId: string, userCoords: Coordinates, locationCoords: Coordinates) => void
  lastUpdated: Date | null
  isUpdating: boolean
}

export function PickupCard({ pickup, isActive, settings, onBufferUpdate, onLocationUpdate, lastUpdated, isUpdating }: PickupCardProps) {
  const [departureTime, setDepartureTime] = useState<number | null>(null)
  const [timeUntilDeparture, setTimeUntilDeparture] = useState<number | null>(null)
  const [isEditingBuffer, setIsEditingBuffer] = useState(false)
  const [bufferInput, setBufferInput] = useState("")
  const [isSettingLocation, setIsSettingLocation] = useState(false)
  const [userLocation, setUserLocation] = useState("")
  const [userCoordsTemp, setUserCoordsTemp] = useState<Coordinates | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  // Track last time-left to detect crossing the 0s threshold and a per-pickup notification key to avoid loops
  const prevTimeLeftRef = useRef<number | null>(null)
  const notifiedKeyRef = useRef<string | null>(null)

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

  const handleUseCurrentLocation = async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return
    try {
      setIsLoadingLocation(true)
      const coords: Coordinates = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })
      setUserCoordsTemp(coords)
    } catch (error) {
      console.error('Failed to get current location:', error)
    } finally {
      setIsLoadingLocation(false)
    }
  }

  const handleSaveLocation = () => {
    if (!userCoordsTemp || !pickup.locationCode) return
    
    // Get station coordinates from the dataset
    const stationData = AllStationsJSON.find(s => s.crsCode === pickup.locationCode)
    if (!stationData) return

    const locationCoords = {
      latitude: stationData.lat,
      longitude: stationData.long
    }

    if (onLocationUpdate) {
      onLocationUpdate(pickup.id, userCoordsTemp, locationCoords)
    }
    
    setIsSettingLocation(false)
    setUserLocation("")
    setUserCoordsTemp(null)
  }

  // Combined time calculations and countdown effect (only when active)
  useEffect(() => {
    if (!isActive) return
    
    // Calculate departure time
    const calculateDepartureTime = () => {
      const scheduledArrival = pickup.scheduledArrival ?? 0
      const currentDelay = pickup.currentDelay ?? 0
      const travelTime = pickup.travelTime ?? 0
      const buffer = pickup.buffer ?? 10
      // If we don't have a valid scheduled arrival yet, don't compute
      if (!scheduledArrival || Number.isNaN(scheduledArrival)) return NaN
      const adjustedArrival = scheduledArrival + currentDelay * 60000
      return adjustedArrival - travelTime * 60000 - buffer * 60000
    }

    // Update countdown
    const updateCountdown = () => {
      const leaveAt = calculateDepartureTime()
      // Guard against invalid/placeholder values to prevent premature notifications
      if (!Number.isFinite(leaveAt) || leaveAt <= 0) {
        setDepartureTime(null)
        setTimeUntilDeparture(null)
        prevTimeLeftRef.current = null
        return
      }

      setDepartureTime(leaveAt)

      const now = Date.now()
      const timeLeft = leaveAt - now

      if (timeLeft <= 0) {
        setTimeUntilDeparture(0)
        // Only notify when we cross from >0 to <=0 and for a new leaveAt value
        const crossedThreshold = prevTimeLeftRef.current !== null && prevTimeLeftRef.current > 0
        const notifyKey = `${pickup.id}:${leaveAt}`
        if (crossedThreshold && notifiedKeyRef.current !== notifyKey) {
          if (typeof window !== 'undefined' && "Notification" in window && Notification.permission === "granted") {
            new Notification("Time to leave!", {
              body: `Leave now to arrive ${(pickup.buffer ?? 10)} minutes before the ${pickup.scheduledArrival ? new Date(pickup.scheduledArrival).toLocaleTimeString() : "arrival"} train to ${pickup.location}`,
              icon: "/car-driving.webp",
            })
            notifiedKeyRef.current = notifyKey
          }
        }
      } else {
        setTimeUntilDeparture(timeLeft)
      }

      // Update previous time-left snapshot
      prevTimeLeftRef.current = timeLeft
    }

    // Initial countdown update
    updateCountdown()

    // Set up interval for countdown updates
    const countdownInterval = setInterval(updateCountdown, 1000)

    return () => clearInterval(countdownInterval)
  }, [
    isActive,
    pickup.id,
    pickup.scheduledArrival,
    pickup.currentDelay,
    pickup.travelTime,
    pickup.buffer,
  ])

  const isTimeToLeave = timeUntilDeparture !== null && timeUntilDeparture <= 0

  return (
    <Card
      className={`my-4 p-6 rounded-xl border-0 shadow-md ${isTimeToLeave ? "bg-gradient-to-br from-red-50 to-orange-50" : "bg-gradient-to-br from-blue-50 to-indigo-50"}`}
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
          {pickup.platform !== undefined && (
            <p className="text-sm text-gray-600">Platform {pickup.platform === null ? "N/A" : pickup.platform}</p>
          )}
        </div>
      </div>

      {/* Arrival Time */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <p className="text-md font-bold text-gray-600 mb-2">Arrival Information</p>
        <div className="flex items-baseline gap-10">
          <div>
            <p className="text-sm text-gray-500 mb-1">Scheduled</p>
            <p className="text-lg font-semibold text-gray-900">{pickup.scheduledArrival ? formatTimeOfDay(pickup.scheduledArrival) : "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Expected</p>
            {pickup.currentDelay === 0 ? (
              <p className="text-lg font-semibold text-green-600">On time</p>
            ) : (
              <p className="text-lg font-semibold text-orange-600">
                {pickup.scheduledArrival !== undefined && pickup.currentDelay !== undefined
                  ? formatTimeOfDay(pickup.scheduledArrival + (pickup.currentDelay * 60000))
                  : "—"}
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
          {pickup.currentDelay !== undefined && pickup.currentDelay > 0 && (
            <div className="pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Current Delay</p>
              <p className="text-2xl font-bold text-gray-900">
                {(pickup.currentDelay ?? 0) > 0 ? `+${pickup.currentDelay}` : (pickup.currentDelay ?? 0)} min
              </p>
            </div>
          )}
          
          <div className="pb-4 border-b border-gray-200">
            {isSettingLocation ? (
              <div className="space-y-3 mt-2">
                <Label className="text-sm text-gray-600">Where are you leaving from?</Label>
                {typeof window !== 'undefined' && 'geolocation' in navigator && (
                  <Button
                    onClick={handleUseCurrentLocation}
                    variant="outline"
                    className="w-full"
                    disabled={isLoadingLocation}
                    size="sm"
                  >
                    {isLoadingLocation ? (
                      <>
                        <Spinner className="w-3 h-3 mr-2" /> Finding location...
                      </>
                    ) : userCoordsTemp ? 
                      (<>
                        <Check className="w-3 h-3 mr-2" /> Using current location
                      </>) :
                      (<>
                        <Pin className="w-3 h-3 mr-2" /> Use current location
                      </>)}
                  </Button>
                )}
                {userCoordsTemp ? (
                  <p className="text-xs text-gray-500">Location: {userCoordsTemp.latitude.toFixed(4)}, {userCoordsTemp.longitude.toFixed(4)}</p>
                ) : (
                  <div>
                    <PlacesAutocomplete
                      value={userLocation}
                      onChangeAction={(v: string) => { setUserLocation(v); }}
                      onSelectAction={(place) => {
                        setUserLocation(place.address)
                        if (place.location) {
                          setUserCoordsTemp(place.location)
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter your address</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveLocation}
                    disabled={!userCoordsTemp}
                    className="flex-1"
                  >
                    Save Location
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsSettingLocation(false)
                      setUserLocation("")
                      setUserCoordsTemp(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (pickup.travelTime !== undefined && pickup.userCoords && pickup.locationCoords) ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Live Travel Time</p>
                    <p className="text-lg font-semibold text-gray-900">{pickup.travelTime} minutes</p>
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSettingLocation(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                <div className="mt-2">
                  <MapDirectionsButton
                    origin={pickup.userCoords}
                    destination={pickup.locationCoords}
                  />
                </div>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingLocation(true)}
                className="w-full"
              >
                <Pin className="w-3 h-3 mr-2" />
                Set Your Location
              </Button>
            )}
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
                        setBufferInput((pickup.buffer ?? 10).toString())
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
