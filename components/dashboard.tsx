"use client";

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PickupCard } from "@/components/pickup-card"
import { AddPickupForm } from "@/components/add-pickup-form"
import { Plus, Check, Trash2 } from "lucide-react"
import { MapDirectionsButton } from "@/components/maps-direction-button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel"
import NavDock from "@/components/NavDock";

interface Coordinates {
  latitude: number
  longitude: number
}
interface Pickup {
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
  completed: boolean
  createdAt: number
  passengerName?: string
  origin?: string,
  platform?: string
  operator?: string
}

export function Dashboard() {
  const [api, setApi] = useState<CarouselApi>()
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [activePickup, setActivePickup] = useState<Pickup | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [departureTime, setDepartureTime] = useState<number | null>(null)
  const [timeUntilDeparture, setTimeUntilDeparture] = useState<number | null>(null)
  const [notificationShown, setNotificationShown] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date())
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditingBuffer, setIsEditingBuffer] = useState(false)
  const [bufferInput, setBufferInput] = useState("")
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    updateFrequency: 1,
    localOnlyMode: false
  })

  // Load settings and pickups on mount
  useEffect(() => {
    // Load settings
    const storedSettings = localStorage.getItem("gofetch_settings")
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings))
    }

    // Load active pickups
    const storedPickups = localStorage.getItem("gofetch_pickups")
    if (storedPickups) {
      const parsed = JSON.parse(storedPickups)
      const activePickups = parsed.filter((p: any) => !p.completed)
      setPickups(activePickups)
      if (activePickups.length > 0) {
        setActivePickup(activePickups[0])
      }
    }

    // Listen for settings updates
    const handleSettingsUpdate = (event: CustomEvent) => {
      setSettings(event.detail)
    }

    window.addEventListener("settingsUpdated", handleSettingsUpdate as EventListener)

    return () => {
      window.removeEventListener("settingsUpdated", handleSettingsUpdate as EventListener)
    }
  }, [])

  const refreshTrainDetails = async (pickup: Pickup) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/trains/details?station=${pickup.locationCode}&stationName=${pickup.location}&trainId=${pickup.id}`)
      if (!response.ok) throw new Error('Failed to fetch train details')
      
      const data = await response.json()
      if (!data.scheduledAt || !data.estimatedAt) return
      
      // Parse HH:MM times and convert to timestamps
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number)
        const date = new Date()
        date.setHours(hours, minutes, 0, 0)
        return date.getTime()
      }

      // Convert API times to timestamps and calculate new delay
      const scheduledTime = parseTime(data.scheduledAt)
      const estimatedTime = parseTime(data.estimatedAt)
      const newDelay = Math.round((estimatedTime - scheduledTime) / 60000) // Convert to minutes

      // Update travel time
      const travelTimeResponse = await fetch('/api/travel-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origin: activePickup?.userCoords,
          destination: activePickup?.locationCoords
        })
      })

      const travelTimeData = await travelTimeResponse.json()
      const newTravelTime = travelTimeData.duration
      
      // Update pickup in local storage and state
      const storedPickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
      const updated = storedPickups.map((p: Pickup) =>
        p.id === pickup.id ? { ...p, currentDelay: newDelay, travelTime: newTravelTime } : p
      )
      localStorage.setItem("gofetch_pickups", JSON.stringify(updated))
      
      // Update active pickup and pickups list
      setPickups(prev => prev.map(p =>
        p.id === pickup.id ? { ...p, currentDelay: newDelay, travelTime: newTravelTime } : p
      ))
      if (pickup.id === activePickup?.id) {
        const updatedPickup = { ...activePickup, currentDelay: newDelay, travelTime: newTravelTime };
        setActivePickup(updatedPickup)
      }
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error refreshing train details:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const getLastUpdatedText = () => {
    if (isUpdating) return "Updating..."
    if (!lastUpdated) return ""
    const diffMs = Date.now() - lastUpdated.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "Last Updated: Now"
    return `Last Updated: ${diffMin} min ago`
  }

  // Refresh active pickup details every minute
  useEffect(() => {
    if (!activePickup || activePickup.type !== 'train') return

    // Set up interval for periodic refreshes
    const interval = setInterval(() => {
      refreshTrainDetails(activePickup)
    }, settings.updateFrequency * 60000) // Convert minutes to milliseconds

    return () => clearInterval(interval)
  }, [activePickup])

  // Combined time calculations and countdown effect
  useEffect(() => {
    if (!activePickup) return

    // Reset states when active pickup changes
    setNotificationShown(false)
    
    // Calculate initial departure time
    const calculateDepartureTime = () => {
      const adjustedArrival = activePickup.scheduledArrival + activePickup.currentDelay * 60000
      return adjustedArrival - activePickup.travelTime * 60000 - activePickup.buffer * 60000
    }

    // Set initial departure time
    const initialDeparture = calculateDepartureTime()
    setDepartureTime(initialDeparture)

    // Update countdown
    const updateCountdown = () => {
      const now = Date.now()
      const timeLeft = initialDeparture - now

      if (timeLeft <= 0) {
        setTimeUntilDeparture(0)
        if (!notificationShown && settings.notificationsEnabled) {
          // Show notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("GoFetch", {
              body: `Leave now to arrive ${activePickup.buffer} minutes before the ${new Date(activePickup.scheduledArrival).toLocaleTimeString()} train from ${activePickup.origin} gets in at ${activePickup.location}`,
              icon: "/car-driving.webp",
            })
          }
          setNotificationShown(true)
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
  }, [activePickup])

  // Handle carousel selection
  useEffect(() => {
    if (!api) return

    api.on("select", () => {
      const newIndex = api.selectedScrollSnap()
      setActivePickup(pickups[newIndex])
    })
  }, [api, pickups])

  const handleCompletePickup = () => {
    if (activePickup) {
      const storedPickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
      const updated = storedPickups.map((p: any) => 
        p.id === activePickup.id ? { ...p, completed: true } : p
      )
      localStorage.setItem("gofetch_pickups", JSON.stringify(updated))
      
      // Update state
      const newActivePickups = pickups.filter(p => p.id !== activePickup.id)
      setPickups(newActivePickups)
      setActivePickup(newActivePickups[0] || null)
    }
  }

  const handleUpdateBuffer = () => {
    if (!activePickup || !bufferInput) return

    const newBuffer = parseInt(bufferInput)
    if (isNaN(newBuffer) || newBuffer < 0) return

    // Update in localStorage
    const storedPickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
    const updated = storedPickups.map((p: Pickup) =>
      p.id === activePickup.id ? { ...p, buffer: newBuffer } : p
    )
    localStorage.setItem("gofetch_pickups", JSON.stringify(updated))

    // Update state
    setPickups(pickups.map(p =>
      p.id === activePickup.id ? { ...p, buffer: newBuffer } : p
    ))
    setActivePickup({ ...activePickup, buffer: newBuffer })
    setIsEditingBuffer(false)
  }

  const handleDeletePickup = () => {
    if (activePickup) {
      const storedPickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
      const updated = storedPickups.filter((p: any) => p.id !== activePickup.id)
      localStorage.setItem("gofetch_pickups", JSON.stringify(updated))
      
      // Update state
      const newActivePickups = pickups.filter(p => p.id !== activePickup.id)
      setPickups(newActivePickups)
      setActivePickup(newActivePickups[0] || null)
    }
  }

  if (showAddForm) {
    return (
      <div className="min-h-screen pt-8 px-4 pb-24">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6">Add Another Pickup</h2>
          <AddPickupForm
              onSuccess={() => {
              setShowAddForm(false)
              // Reload pickups
              const storedPickups = localStorage.getItem("gofetch_pickups")
              if (storedPickups) {
                const parsed = JSON.parse(storedPickups)
                const activePickups = parsed.filter((p: any) => !p.completed)
                setPickups(activePickups)
                // Find the most recently added pickup (highest createdAt value)
                const latestPickup = activePickups.reduce((latest: Pickup | null, pickup: Pickup) => 
                  !latest || pickup.createdAt > latest.createdAt ? pickup : latest
                , null)
                if (latestPickup) {
                  setActivePickup(latestPickup)
                  setTimeUntilDeparture(null)
                  setNotificationShown(false)
                }
              }
            }}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      </div>
    )
  }

  if (!activePickup) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">No Active Pickups</h2>
          <p className="text-muted-foreground mb-6">Create a new pickup to get started</p>
          <Button
            variant={"default"}
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pickup
          </Button>
        </div>
        <NavDock />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-8 px-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">GoFetch</h1>
          <p className="text-muted-foreground">Active Pickup {pickups.length > 1 && `(${pickups.indexOf(activePickup) + 1}/${pickups.length})`}</p>
        </div>

        {/* Main Pickup Card */}
        <Carousel 
          setApi={setApi}
          className="basis-1/3"
        >
          <CarouselContent>
            {pickups.map((pickup) => (
              <CarouselItem key={pickup.id}>
                <PickupCard 
                  pickup={pickup.id === activePickup.id ? activePickup : pickup} 
                  departureTime={pickup.id === activePickup.id ? departureTime : null} 
                  timeUntilDeparture={pickup.id === activePickup.id ? timeUntilDeparture : null} 
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {pickups.length > 1 && (
            <>
              <CarouselPrevious />
              <CarouselNext />
            </>
          )}
        </Carousel>

        {/* Status Info */}
        <Card className="mb-4 p-6 border-0 rounded-t-none rounded-b-xl shadow-lg bg-background dark:bg-stone-900">
          <div className="space-y-4">
            {activePickup.currentDelay > 0 && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-muted-foreground mb-1">Current Delay</p>
                <p className="text-2xl font-bold text-foreground">
                  {activePickup.currentDelay > 0 ? `+${activePickup.currentDelay}` : activePickup.currentDelay} min
                </p>
              </div>
            )}
            <div className="pb-4 border-b border-gray-200">
              <p className="text-sm text-muted-foreground mb-1">Live Travel Time</p>
              <p className="text-lg font-semibold text-foreground mb-2">{activePickup.travelTime} minutes</p>
              <MapDirectionsButton
                origin={activePickup.userCoords}
                destination={activePickup.locationCoords}
              />
            </div>
            <div className="">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Safety Buffer</p>
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
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-foreground">{activePickup.buffer} minutes</p>
                  )}
                </div>
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!isEditingBuffer) {
                        setBufferInput(activePickup.buffer.toString())
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
                <p className="text-sm text-gray-500">This buffer is added to ensure you arrive early. Adjust as needed.</p>
              </div>
            </div>
            <div className="w-full flex justify-center pt-2">
              <span className="text-xs text-gray-500">{getLastUpdatedText()}</span>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => setShowAddForm(true)}
            variant="outline"
            className="w-full text-foreground bg-transparent"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Pickup
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleCompletePickup}
              variant="outline"
              className="w-full text-foreground bg-transparent"
            >
              <Check className="w-4 h-4" /> Complete Pickup
            </Button>
            <Button
              onClick={handleDeletePickup}
              variant="outline"
              className="w-full text-foreground bg-transparent"
            >
              <Trash2 className="w-4 h-4" /> Delete Pickup
            </Button>
          </div>
          
        </div>
      </div>
      <NavDock />
    </div>
  )
}