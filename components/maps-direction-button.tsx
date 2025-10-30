"use client";

import { Button } from "@/components/ui/button";
import { MapPinned } from "lucide-react";

interface MapDirectionsButtonProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}

export function MapDirectionsButton({ origin, destination }: MapDirectionsButtonProps) {
  const handleClick = () => {
    const { latitude: oLat, longitude: oLng } = origin;
    const { latitude: dLat, longitude: dLng } = destination;
    // Simple mobile detection (good enough for choosing deep links)
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)

    // Read user settings from localStorage if available. We'll look for a
    // preference key like `preferredNavigationApp`. Since this may not exist
    // yet, default to 'google'. The user said they will add the preference UI later.
    let preferredApp = 'google'
    try {
      const stored = localStorage.getItem('gofetch_settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.preferredNavigationApp) preferredApp = parsed.preferredNavigationApp
      }
    } catch (e) {
      // ignore parsing errors and fall back to default
    }

    // Build URLs. These are placeholder/deep-link formats
    const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`
    const googleMapsApp = `comgooglemapsurl://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`
    const appleMaps = `maps://?&daddr=${dLat},${dLng}&dirflg=d`
    const waze = `https://www.waze.com/ul?ll=${dLat},${dLng}&navigate=yes`

    let urlToOpen = googleMapsWeb

    if (!isMobile) {
      // Desktop: use the Google Maps web URL
      urlToOpen = googleMapsWeb
    } else {
      // Mobile: choose based on preferred app
      switch ((preferredApp || '').toLowerCase()) {
        case 'apple':
        case 'applemaps':
        case 'apple_maps':
          urlToOpen = appleMaps
          break
        case 'waze':
          urlToOpen = waze
          break
        case 'google':
        case 'googlemaps':
        default:
          // On mobile prefer the Google Maps app deep link if available
          urlToOpen = googleMapsApp
          break
      }
    }

    // Open the selected URL. For app deep-links this will either open the app
    window.open(urlToOpen, '_blank')
  };

  return (
    <Button onClick={handleClick} variant="default">
      <MapPinned className="h-4 w-4" />
      Open Driving Route
    </Button>
  );
}
