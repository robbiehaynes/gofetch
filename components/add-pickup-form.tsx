"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AllStationsJSON, { StationData } from "uk-railway-stations"
import { ArrowLeft, Clock, Pin, Check } from "lucide-react"

interface AddPickupFormProps {
  onSuccess: () => void
  onCancel: () => void
}

interface TrainService {
  id: string
  due: string
  expected: string
  platform: string
  operator: string
  origin: string
}

interface Coordinates {
  latitude: number
  longitude: number
}

interface TrainlineResponse {
  data: {
    services: TrainService[]
  }
}

async function fetchTrainArrivals(stationCode: string): Promise<TrainService[]> {
  try {
    const response = await fetch(`/api/trains?station=${stationCode}`)
    if (!response.ok) {
      throw new Error('Failed to fetch train arrivals')
    }
    const data: TrainlineResponse = await response.json()
    return data.data.services
  } catch (error) {
    console.error('Error fetching train arrivals:', error)
    return []
  }
}

const fetchTravelTime = async (from: Coordinates, to: Coordinates) => {
  const response = await fetch('/api/travel-time', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      origin: from,
      destination: to
    })
  })

  const data = await response.json()
  return data.duration
}

export function AddPickupForm({ onSuccess, onCancel }: AddPickupFormProps) {
  const [step, setStep] = useState<"train-station" | "train-selection" | "location">("train-station")
  const [stationSearch, setStationSearch] = useState("")
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedTrain, setSelectedTrain] = useState<TrainService | null>(null)
  const [trainServices, setTrainServices] = useState<TrainService[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [passengerName, setPassengerName] = useState("")
  const [userLocation, setUserLocation] = useState("")
  const [userCoordsState, setUserCoordsState] = useState<Coordinates | null>(null)
  const [buffer, setBuffer] = useState("10")

  const filteredStations = AllStationsJSON.filter(
    (station) =>
      station.stationName.toLowerCase().includes(stationSearch.toLowerCase()) ||
      station.crsCode.toLowerCase().includes(stationSearch.toLowerCase()),
  )

  const handleStationSelect = async (station: StationData) => {
    setSelectedStation(station)
    setIsLoading(true)
    setStep("train-selection")
    
    try {
      const services = await fetchTrainArrivals(station.crsCode)
      setTrainServices(services)
    } catch (error) {
      console.error("Error fetching train services:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrainSelect = (train: TrainService) => {
    setSelectedTrain(train)
    setStep("location")
  }

  const handleUseCurrentLocation = async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return
    try {
      setIsLoading(true)
      const coords: Coordinates = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })
      setUserCoordsState(coords)
      // Optionally set a friendly label so users know current location was used
      setUserLocation('Geolocation')
    } catch (error) {
      console.error('Failed to get current location:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if ((!userLocation && !userCoordsState) || !buffer || !selectedTrain || !selectedStation) {
      console.error("Please fill in all required fields.")
      return
    }

    // Get station coordinates
    const selectedStationCoords = {
      latitude: AllStationsJSON.find(
        (station) => station.crsCode === selectedStation.crsCode
      )?.lat || 0,
      longitude: AllStationsJSON.find(
        (station) => station.crsCode === selectedStation.crsCode
      )?.long || 0
    }

    try {
      // Determine user's coordinates: use geolocation if available (and set), otherwise geocode the address
      let userCoords: Coordinates
      if (userCoordsState) {
        userCoords = userCoordsState
      } else {
        // Get user's coordinates from their address using our geocoding endpoint
        const geocodeResponse = await fetch(
          `/api/geocode?address=${encodeURIComponent(userLocation)}`
        )
        
        if (!geocodeResponse.ok) {
          throw new Error('Failed to geocode address')
        }

        const geocodeJson = await geocodeResponse.json()
        if ('error' in geocodeJson) {
          throw new Error(geocodeJson.error)
        }

        userCoords = { latitude: geocodeJson.latitude, longitude: geocodeJson.longitude }
      }

      // Get travel time using our API
      const travelTime = await fetchTravelTime(userCoords, selectedStationCoords)
      if (!travelTime) {
        throw new Error('Failed to calculate travel time')
      }

      const now = Date.now()
      
      // Parse train times
      const [hours, minutes] = selectedTrain.due.split(":").map(Number)
      const trainTime = new Date()
      trainTime.setHours(hours, minutes, 0)
      const scheduledArrival = trainTime.getTime()

      // Calculate delay if the train is not on time
      let currentDelay = 0
      if (selectedTrain.expected !== "On time") {
        const [expHours, expMinutes] = selectedTrain.expected.split(":").map(Number)
        const expectedTime = new Date()
        expectedTime.setHours(expHours, expMinutes, 0)
        currentDelay = Math.round((expectedTime.getTime() - trainTime.getTime()) / 60000)
      }

      const pickup = {
        id: selectedTrain?.id,
        type: "train" as const,
        location: selectedStation?.stationName,
        locationCode: selectedStation?.crsCode,
        locationCoords: selectedStationCoords,
        scheduledArrival,
        currentDelay,
        userCoords,
        travelTime,
        buffer: Number.parseInt(buffer),
        completed: false,
        createdAt: now,
        passengerName: passengerName || undefined,
        origin: selectedTrain?.origin,
        platform: selectedTrain?.platform,
        operator: selectedTrain?.operator,
      }

      // Save to localStorage
      const pickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
      pickups.push(pickup)
      localStorage.setItem("gofetch_pickups", JSON.stringify(pickups))

      onSuccess()
    } catch (error) {
      console.error('Error creating pickup:', error)
      // Here you might want to show an error message to the user
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Train Station Search */}
      {step === "train-station" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Button onClick={onCancel} variant={"ghost"} className="p-2 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <h2 className="text-2xl font-bold text-foreground">Select Station</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground font-semibold mb-2 block">Train Station</Label>
              <Input
                placeholder="Search station name or code..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                className="border-gray-300"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">Start typing to find your station</p>
            </div>

            <div className="relative">
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pb-16">
                {filteredStations.length > 0 ? (
                  filteredStations.map((station) => (
                    <Card
                      key={station.crsCode}
                      onClick={() => handleStationSelect(station)}
                      className="p-4 mr-2 border border-gray-200 cursor-pointer hover:bg-muted transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-foreground">{station.stationName}</h3>
                          <p className="text-sm text-muted-foreground">{station.crsCode}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : stationSearch ? (
                  <p className="text-center text-muted-foreground py-4">No stations found</p>
                ) : (
                  <p className="text-center text-muted-foreground py-4">Start typing to search</p>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Train Selection */}
      {step === "train-selection" && selectedStation && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <Button variant={"ghost"} onClick={() => setStep("train-station")} className="p-2 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </Button>
            <h2 className="text-2xl font-bold text-foreground">Select Train</h2>
          </div>

          <div>
            <Label className="text-muted-foreground font-semibold mb-2 block">Passenger Name (Optional)</Label>
            <Input
              placeholder="e.g., John Smith"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
              className="border-gray-300"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground dark:text-background">
              <span className="font-semibold">{selectedStation.stationName} ({selectedStation.crsCode})</span>
            </p>
          </div>

          <div className="relative">
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-8">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading train services...</p>
              ) : trainServices.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No trains found</p>
              ) : (
                trainServices.map((train) => (
                  <Card
                    key={train.id}
                    onClick={() => handleTrainSelect(train)}
                    className="p-4 mr-2 border border-gray-200 cursor-pointer hover:bg-muted transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground">{train.due}</span>
                          {train.expected !== "On time" && (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              Expected: {train.expected}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">From: {train.origin}</p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-xs text-muted-foreground">Platform: {train.platform || "TBA"}</p>
                          <p className="text-xs text-muted-foreground">{train.operator}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Step 3: Location & Travel Time */}
      {step === "location" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setStep("train-selection")}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <h2 className="text-2xl font-bold text-foreground">Your Location</h2>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground font-semibold">Where are you leaving from?</Label>
            {typeof window !== 'undefined' && 'geolocation' in navigator && (
              <div>
                <Button
                  onClick={handleUseCurrentLocation}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Spinner className="w-2 h-2" /> Finding location...
                    </>
                  ) : userCoordsState ? 
                    (<>
                      <Check className="w-2 h-2" /> Using current location
                    </>) :
                    (<>
                      <Pin className="w-2 h-2" /> Use current location
                    </>)}
                </Button>
              </div>
            )}
            {userCoordsState ? (
              <p className="text-xs text-muted-foreground mt2">Using current location: {userCoordsState.latitude.toFixed(4)}, {userCoordsState.longitude.toFixed(4)}</p>
            ) : (
              <div>
                <Input
                  placeholder="e.g., 123 Main Street, Manchester"
                  value={userLocation}
                  onChange={(e) => setUserLocation(e.target.value)}
                  className="border-gray-300"
                />
                <p className="text-xs text-muted-foreground mt-2">Enter your address or current location</p>
              </div>
            )}
            <div className="my-6 py-2">
              <Label className="text-muted-foreground font-semibold">Safety Buffer (minutes)</Label>
              <Input
                type="number"
                placeholder="10"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                className="border-gray-300"
              />
              <p className="text-xs text-muted-foreground mt-2">Extra time to arrive early</p>
            </div>

            <Button
              variant={"default"}
              onClick={handleSubmit}
              className="w-full font-semibold"
            >
              Create Pickup
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full border-gray-300 text-foreground hover:bg-gray-50 bg-transparent"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
