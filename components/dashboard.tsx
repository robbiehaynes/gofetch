"use client";

import { useState, useEffect } from "react"
import Image from "next/image";
import { setOptions } from "@googlemaps/js-api-loader";
import { Button } from "@/components/ui/button"
import { PickupCard } from "@/components/pickup-card"
import { AddPickupForm } from "@/components/add-pickup-form"
import { Plus, Check, Trash2 } from "lucide-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel"
import { Spinner } from "@/components/ui/spinner";
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
  completed: boolean
  createdAt: number
}
// Runtime-only details we derive client-side
interface PickupRuntime {
  locationCoords?: Coordinates
  userCoords?: Coordinates
  buffer: number
  scheduledArrival: number
  currentDelay: number
  travelTime: number
  origin?: string
  platform?: string
  operator?: string
}

export function Dashboard() {
  const [api, setApi] = useState<CarouselApi>()
  const [pickups, setPickups] = useState<Pickup[]>([])
  const [activeDetails, setActiveDetails] = useState<PickupRuntime | null>(null)
  const [activePickup, setActivePickup] = useState<Pickup | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date())
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoadingPickups, setIsLoadingPickups] = useState(true)
  const [isCompletingPickup, setIsCompletingPickup] = useState(false)
  const [isDeletingPickup, setIsDeletingPickup] = useState(false)
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    updateFrequency: 1,
    localOnlyMode: false
  })

  useEffect(() => {
    setOptions({
      key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: "weekly",
    })
  }, [])

  // Load settings and pickups on mount
  useEffect(() => {
    // Load settings
    const storedSettings = localStorage.getItem("gofetch_settings")
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings))
    }

    // Load active pickups from API
    const loadPickups = async () => {
      setIsLoadingPickups(true)
      try {
        const res = await fetch('/api/pickups', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load pickups')
        const json = await res.json()
        const all = json.data || []
        const activePickups = all.filter((p: any) => !p.completed)
        setPickups(activePickups)
        if (activePickups.length > 0) {
          const first = activePickups[0]
          setActivePickup(first)
          // Seed active details from localStorage
          const buffers = JSON.parse(localStorage.getItem('gofetch_buffers') || '{}')
          const coords = JSON.parse(localStorage.getItem('gofetch_coords') || '{}')
          const seed: PickupRuntime = {
            buffer: buffers[first.id] ?? 5,
            scheduledArrival: Date.now(),
            currentDelay: 0,
            travelTime: 0,
            ...(coords[first.id] || {})
          }
          setActiveDetails(seed)
          // Kick off initial details refresh
          setTimeout(() => {
            refreshTrainDetails(first, seed)
          }, 0)
        }
      } catch (e) {
        console.error('Error loading pickups:', e)
      } finally {
        setIsLoadingPickups(false)
      }
    }
    loadPickups()

    // Listen for settings updates
    const handleSettingsUpdate = (event: CustomEvent) => {
      setSettings(event.detail)
    }

    window.addEventListener("settingsUpdated", handleSettingsUpdate as EventListener)

    return () => {
      window.removeEventListener("settingsUpdated", handleSettingsUpdate as EventListener)
    }
  }, [])

  // Load/refresh live details for a pickup (times, travel time) without persisting
  const refreshTrainDetails = async (pickup: Pickup, details?: PickupRuntime | null) => {
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

      // Optionally compute travel time if we have coords
      const rt = details ?? activeDetails
      let newTravelTime = rt?.travelTime || 0 // preserve existing if not recomputed
      if (rt?.userCoords && rt?.locationCoords) {
        try {
          const travelTimeResponse = await fetch('/api/travel-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin: rt.userCoords, destination: rt.locationCoords })
          })
          const travelTimeData = await travelTimeResponse.json()
          newTravelTime = travelTimeData.duration || 0
        } catch (e) {
          console.warn('Travel time failed:', e)
        }
      }

      // Update active details only if this pickup is active
      if (activePickup && pickup.id === activePickup.id) {
        setActiveDetails(prev => ({
          buffer: prev?.buffer ?? 5,
          scheduledArrival: scheduledTime,
          currentDelay: newDelay,
          travelTime: newTravelTime,
          userCoords: rt?.userCoords ?? prev?.userCoords,
          locationCoords: rt?.locationCoords ?? prev?.locationCoords,
          origin: prev?.origin,
          platform: prev?.platform,
          operator: prev?.operator,
        }))
      }
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error refreshing train details:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Refresh active pickup details every minute
  useEffect(() => {
    if (!activePickup || activePickup.type !== 'train') return
    // initial refresh with current details
    refreshTrainDetails(activePickup, activeDetails)
    const interval = setInterval(() => {
      refreshTrainDetails(activePickup, activeDetails)
    }, settings.updateFrequency * 60000)
    return () => clearInterval(interval)
  }, [activePickup, activeDetails?.userCoords, activeDetails?.locationCoords, settings.updateFrequency])

  // Handle carousel selection
  useEffect(() => {
    if (!api) return

    api.on("select", () => {
      const newIndex = api.selectedScrollSnap()
      const next = pickups[newIndex]
      setActivePickup(next)
      // seed details for new active
      const buffers = JSON.parse(localStorage.getItem('gofetch_buffers') || '{}')
      const coords = JSON.parse(localStorage.getItem('gofetch_coords') || '{}')
      const seed: PickupRuntime = {
        buffer: buffers[next.id] ?? 5,
        scheduledArrival: Date.now(),
        currentDelay: 0,
        travelTime: 0,
        ...(coords[next.id] || {})
      }
      setActiveDetails(seed)
      // refresh details for new active
      setTimeout(() => refreshTrainDetails(next, seed), 0)
    })
  }, [api, pickups])

  const handleCompletePickup = async () => {
    if (!activePickup) return
    setIsCompletingPickup(true)
    try {
      await fetch(`/api/pickups?id=${activePickup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      })
    } catch (e) {
      console.error('Failed to complete pickup:', e)
    } finally {
      setIsCompletingPickup(false)
    }
    // Update state
    const newActivePickups = pickups.filter(p => p.id !== activePickup.id)
    setPickups(newActivePickups)
    setActivePickup(newActivePickups[0] || null)
  }

  const handleUpdateBuffer = async (pickupId: string, newBuffer: number) => {
    // Store buffer client-side only (no server persistence)
    try {
      const map = JSON.parse(localStorage.getItem('gofetch_buffers') || '{}')
      map[pickupId] = newBuffer
      localStorage.setItem('gofetch_buffers', JSON.stringify(map))
    } catch {}
    if (activePickup && pickupId === activePickup.id) {
      setActiveDetails(prev => prev ? { ...prev, buffer: newBuffer } : { buffer: newBuffer, scheduledArrival: Date.now(), currentDelay: 0, travelTime: 0 })
    }
  }

  const handleLocationUpdate = async (pickupId: string, userCoords: Coordinates, locationCoords: Coordinates) => {
    // Store coords client-side and compute travel time
    try {
      const coordsMap = JSON.parse(localStorage.getItem('gofetch_coords') || '{}')
      coordsMap[pickupId] = { userCoords, locationCoords }
      localStorage.setItem('gofetch_coords', JSON.stringify(coordsMap))
    } catch {}

    // Compute travel time
    let travelTime = 0
    try {
      const travelTimeResponse = await fetch('/api/travel-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: userCoords, destination: locationCoords })
      })
      const travelTimeData = await travelTimeResponse.json()
      travelTime = travelTimeData.duration || 0
    } catch (e) {
      console.warn('Travel time failed:', e)
    }

    if (activePickup && pickupId === activePickup.id) {
      setActiveDetails(prev => ({
        buffer: prev?.buffer ?? 5,
        scheduledArrival: prev?.scheduledArrival ?? Date.now(),
        currentDelay: prev?.currentDelay ?? 0,
        travelTime,
        userCoords,
        locationCoords,
        origin: prev?.origin,
        platform: prev?.platform,
        operator: prev?.operator,
      }))
    }
  }

  const handleDeletePickup = async () => {
    if (!activePickup) return
    setIsDeletingPickup(true)
    try {
      await fetch(`/api/pickups?id=${activePickup.id}`, { method: 'DELETE' })

      // Also remove stored coords and buffer
      try {
        const coordsMap = JSON.parse(localStorage.getItem('gofetch_coords') || '{}')
        delete coordsMap[activePickup.id]
        localStorage.setItem('gofetch_coords', JSON.stringify(coordsMap))
      } catch {}
      try {
        const bufferMap = JSON.parse(localStorage.getItem('gofetch_buffers') || '{}')
        delete bufferMap[activePickup.id]
        localStorage.setItem('gofetch_buffers', JSON.stringify(bufferMap))
      } catch {}
    } catch (e) {
      console.error('Failed to delete pickup:', e)
    } finally {
      setIsDeletingPickup(false)
    }
    // Update state
    const newActivePickups = pickups.filter(p => p.id !== activePickup.id)
    setPickups(newActivePickups)
    setActivePickup(newActivePickups[0] || null)
  }

  // Safely merge active runtime-only details without overwriting server fields with undefined
  const mergeActivePickup = (p: Pickup) => {
    const d = activeDetails
    return {
      ...p,
      buffer: d?.buffer ?? (p as any).buffer,
      scheduledArrival: d?.scheduledArrival ?? (p as any).scheduledArrival,
      currentDelay: d?.currentDelay ?? (p as any).currentDelay,
      travelTime: d?.travelTime ?? (p as any).travelTime,
      userCoords: d?.userCoords ?? (p as any).userCoords,
      locationCoords: d?.locationCoords ?? (p as any).locationCoords,
    } as any
  }

  if (showAddForm) {
    return (
      <div className="min-h-screen pt-8 px-4 pb-24">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6">Add Another Pickup</h2>
          <AddPickupForm
            onSuccess={async () => {
              setShowAddForm(false)
              // Reload pickups from API, place the latest at index 0
              try {
                const res = await fetch('/api/pickups', { cache: 'no-store' })
                if (!res.ok) throw new Error('Failed to reload pickups')
                const json = await res.json()
                const active = (json.data || []).filter((p: Pickup) => !p.completed)
                // Find most recently created
                const latest = active.reduce((acc: Pickup | null, p: Pickup) => !acc || p.createdAt > acc.createdAt ? p : acc, null)
                if (latest) {
                  const reordered = [latest, ...active.filter((p: Pickup) => p.id !== latest.id)]
                  setPickups(reordered)
                  setActivePickup(latest)
                  // Seed runtime defaults
                  const buffers = JSON.parse(localStorage.getItem('gofetch_buffers') || '{}')
                  const coords = JSON.parse(localStorage.getItem('gofetch_coords') || '{}')
                  setActiveDetails({
                    buffer: buffers[latest.id] ?? 5,
                    scheduledArrival: Date.now(),
                    currentDelay: 0,
                    travelTime: 0,
                    ...(coords[latest.id] || {})
                  })
                  // trigger details refresh for latest
                  setTimeout(() => refreshTrainDetails(latest), 0)
                } else {
                  setPickups(active)
                  setActivePickup(active[0] || null)
                }
              } catch (e) {
                console.error(e)
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
          {isLoadingPickups ? (
            <>
              <div className="items-center justify-center flex flex-col">
                <Spinner className="mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Loading pickups...</h2>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-foreground mb-2">No Active Pickups</h2>
              <p className="text-muted-foreground mb-6">Create a new pickup to get started</p>
              <Button
                variant={"default"}
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Pickup
              </Button>
            </>
          )}
        </div>
        <NavDock />
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-8 px-4 pb-24">
      <div className="max-w-[90vw] md:max-w-lg mx-auto">
        {/* Header */}
        <div>
          <Image 
            src="/logo.png"
            alt="GoFetch Logo"
            width={200}
            height={200}
            className="object-fit mb-2"
          />
          <p className="text-muted-foreground">Active Pickup {pickups.length > 1 && `(${pickups.indexOf(activePickup) + 1}/${pickups.length})`}</p>
        </div>

        {/* Main Pickup Card */}
        {pickups.length === 1 ? (
          <PickupCard 
            pickup={mergeActivePickup(activePickup)}
            isActive={true}
            settings={settings}
            onBufferUpdate={handleUpdateBuffer}
            onLocationUpdate={handleLocationUpdate}
            lastUpdated={lastUpdated}
            isUpdating={isUpdating}
          />
        ) : (
          <Carousel 
            setApi={setApi}
            className="basis-1/3"
          >
            <CarouselContent>
              {pickups.map((pickup) => (
                <CarouselItem key={pickup.id}>
                  <PickupCard 
                    pickup={pickup.id === activePickup.id ? mergeActivePickup(activePickup) : pickup}
                    isActive={pickup.id === activePickup.id}
                    settings={settings}
                    onBufferUpdate={handleUpdateBuffer}
                    onLocationUpdate={handleLocationUpdate}
                    lastUpdated={lastUpdated}
                    isUpdating={isUpdating}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        )}

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
              disabled={isCompletingPickup || isDeletingPickup}
            >
              {isCompletingPickup ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Pickup
                </>
              )}
            </Button>
            <Button
              onClick={handleDeletePickup}
              variant="outline"
              className="w-full text-foreground bg-transparent"
              disabled={isDeletingPickup || isCompletingPickup}
            >
              {isDeletingPickup ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Pickup
                </>
              )}
            </Button>
          </div>
          
        </div>
      </div>
      <NavDock />
    </div>
  )
}