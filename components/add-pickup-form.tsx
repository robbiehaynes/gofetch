"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AllStationsJSON, { StationData } from "uk-railway-stations"
import { ArrowLeft, Clock } from "lucide-react"

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

export function AddPickupForm({ onSuccess, onCancel }: AddPickupFormProps) {
  const [step, setStep] = useState<"train-station" | "train-selection" | "location">("train-station")
  const [stationSearch, setStationSearch] = useState("")
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)
  const [selectedTrain, setSelectedTrain] = useState<TrainService | null>(null)
  const [trainServices, setTrainServices] = useState<TrainService[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [passengerName, setPassengerName] = useState("")
  const [userLocation, setUserLocation] = useState("")
  const [travelTime, setTravelTime] = useState("30")
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

  const handleSubmit = () => {
    if (!userLocation || !travelTime || !buffer || !selectedTrain || !selectedStation) {
      console.error("Please fill in all required fields.")
      return
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
      scheduledArrival,
      currentDelay,
      userLocation,
      travelTime: Number.parseInt(travelTime),
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
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Train Station Search */}
      {step === "train-station" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Select Station</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 font-semibold mb-2 block">Train Station</Label>
              <Input
                placeholder="Search station name or code..."
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                className="border-gray-300"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">Start typing to find your station</p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStations.length > 0 ? (
                filteredStations.map((station) => (
                  <Card
                    key={station.crsCode}
                    onClick={() => handleStationSelect(station)}
                    className="p-4 border border-gray-200 cursor-pointer hover:border-blue-600 hover:bg-blue-50 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{station.stationName}</h3>
                        <p className="text-sm text-gray-500">{station.crsCode}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : stationSearch ? (
                <p className="text-center text-gray-500 py-4">No stations found</p>
              ) : (
                <p className="text-center text-gray-500 py-4">Start typing to search</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Train Selection */}
      {step === "train-selection" && selectedStation && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setStep("train-station")} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Select Train</h2>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{selectedStation.stationName}</span>
            </p>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <p className="text-center text-gray-500 py-4">Loading train services...</p>
            ) : trainServices.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No trains found</p>
            ) : (
              trainServices.map((train) => (
                <Card
                  key={train.id}
                  onClick={() => handleTrainSelect(train)}
                  className="p-4 border border-gray-200 cursor-pointer hover:border-blue-600 hover:bg-blue-50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">{train.due}</span>
                        {train.expected !== "On time" && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                            Expected: {train.expected}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">From: {train.origin}</p>
                      <div className="flex gap-4 mt-1">
                        <p className="text-xs text-gray-500">Platform: {train.platform || "TBA"}</p>
                        <p className="text-xs text-gray-500">{train.operator}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <div>
            <Label className="text-gray-700 font-semibold mb-2 block">Passenger Name (Optional)</Label>
            <Input
              placeholder="e.g., John Smith"
              value={passengerName}
              onChange={(e) => setPassengerName(e.target.value)}
              className="border-gray-300"
            />
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
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">Your Location</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 font-semibold mb-2 block">Where are you leaving from?</Label>
              <Input
                placeholder="e.g., 123 Main Street, Manchester"
                value={userLocation}
                onChange={(e) => setUserLocation(e.target.value)}
                className="border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-2">Enter your address or current location</p>
            </div>

            <div>
              <Label className="text-gray-700 font-semibold mb-2 block">Travel Time (minutes)</Label>
              <Input
                type="number"
                placeholder="30"
                value={travelTime}
                onChange={(e) => setTravelTime(e.target.value)}
                className="border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-2">How long does it take to drive there?</p>
            </div>

            <div>
              <Label className="text-gray-700 font-semibold mb-2 block">Safety Buffer (minutes)</Label>
              <Input
                type="number"
                placeholder="10"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                className="border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-2">Extra time to arrive early</p>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11"
            >
              Create Pickup
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full border-gray-300 text-gray-900 hover:bg-gray-50 bg-transparent"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
