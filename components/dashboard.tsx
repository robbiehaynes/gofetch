"use client";

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PickupCard } from "@/components/pickup-card"
import { AddPickupForm } from "@/components/add-pickup-form"
import { Plus } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel"

interface Pickup {
  id: string
  type: "flight" | "train"
  location: string
  locationCode: string
  scheduledArrival: number
  currentDelay: number
  userLocation: string
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

  useEffect(() => {
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
  }, [])

  const refreshTrainDetails = async (pickup: Pickup) => {
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
      
      // Update pickup in local storage and state
      const storedPickups = JSON.parse(localStorage.getItem("gofetch_pickups") || "[]")
      const updated = storedPickups.map((p: Pickup) => 
        p.id === pickup.id ? { ...p, currentDelay: newDelay } : p
      )
      localStorage.setItem("gofetch_pickups", JSON.stringify(updated))
      
      // Update active pickup and pickups list
      setPickups(prev => prev.map(p => 
        p.id === pickup.id ? { ...p, currentDelay: newDelay } : p
      ))
      if (pickup.id === activePickup?.id) {
        const updatedPickup = { ...activePickup, currentDelay: newDelay };
        setActivePickup(updatedPickup)
      }
    } catch (error) {
      console.error('Error refreshing train details:', error)
    }
  }

  // Refresh active pickup details every minute
  useEffect(() => {
    if (!activePickup || activePickup.type !== 'train') return

    // Set up interval for periodic refreshes
    const interval = setInterval(() => {
      refreshTrainDetails(activePickup)
    }, 60000) // Every minute

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
        if (!notificationShown) {
          // Show notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("GoFetch", {
              body: `Leave now to arrive ${activePickup.buffer} minutes before the ${new Date(activePickup.scheduledArrival).toLocaleTimeString()} train from ${activePickup.origin} gets in at ${activePickup.location}`,
              icon: "/placeholder-logo.svg",
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
  }, [activePickup, notificationShown])

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

  if (showAddForm) {
    return (
      <div className="min-h-screen pt-8 px-4 pb-24">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Another Pickup</h2>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Pickups</h2>
          <p className="text-gray-600 mb-6">Create a new pickup to get started</p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pickup
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-8 px-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">GoFetch</h1>
          <p className="text-gray-600">Active Pickup {pickups.length > 1 && `(${pickups.indexOf(activePickup) + 1}/${pickups.length})`}</p>
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
        <Card className="p-6 border-0 shadow-sm bg-background">
          <div className="space-y-4">
            {activePickup.currentDelay > 0 && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Current Delay</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activePickup.currentDelay > 0 ? `+${activePickup.currentDelay}` : activePickup.currentDelay} min
                </p>
              </div>
            )}
            
            <div className="pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Travel Time</p>
              <p className="text-lg font-semibold text-gray-900">{activePickup.travelTime} minutes</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Safety Buffer</p>
              <p className="text-lg font-semibold text-gray-900">{activePickup.buffer} minutes</p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => setShowAddForm(true)}
            variant="outline"
            className="w-full border-gray-300 text-gray-900 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Pickup
          </Button>
          <Button
            onClick={handleCompletePickup}
            variant="outline"
            className="w-full border-gray-300 text-gray-900 hover:bg-gray-50 bg-transparent"
          >
            Mark as Complete
          </Button>
        </div>
      </div>
    </div>
  )
}