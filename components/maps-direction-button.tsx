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

    const url = `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`;

    window.open(url, "_blank");
  };

  return (
    <Button onClick={handleClick} variant="default">
      <MapPinned className="h-4 w-4" />
      Open Driving Route
    </Button>
  );
}
