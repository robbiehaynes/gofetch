"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { importLibrary } from "@googlemaps/js-api-loader"
import { Input } from "@/components/ui/input"

interface Place {
  address: string
  placeId: string
  location?: {
    latitude: number
    longitude: number
  }
}

type Suggestion = {
  id: string
  text: string
  placeId: string
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (place: Place) => void
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<number | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const fetchSuggestions = useCallback(async (input: string) => {

    if (!input || input.trim().length < 2) {
      setSuggestions([])
      return
    }

    try {
      setLoading(true)
      const { AutocompleteSessionToken, AutocompleteSuggestion } = await importLibrary('places')
      const token = new AutocompleteSessionToken()

      const req = {
        input,
        // optional: restrict by region or bounds if desired
        sessionToken: token,
      }

      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
      const mapped: Suggestion[] = suggestions.map((s: any, i: number) => ({
        id: String(i),
        text: s.placePrediction.text.toString(),
        placeId: s.placePrediction.placeId,
      }))
      setSuggestions(mapped.slice(0, 8))
    } catch (err) {
      console.error('Places autocomplete error:', err)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  const handleSelectPlace = useCallback(async (suggestion: Suggestion) => {
    try {
      setLoading(true)

      const { Place } = await importLibrary('places')

      const place = new Place({id: suggestion.placeId})
      await place.fetchFields({ 
        fields: ['formattedAddress', 'location'],
      })

      onSelect({
        address: place.formattedAddress || suggestion.text,
        placeId: suggestion.placeId,
        location: place.location ? {
          latitude: place.Cg.location.lat,
          longitude: place.Cg.location.lng,
        } : undefined,
      })
      setSuggestions([])
    } catch (err) {
      console.error('Failed to fetch place details:', err)
      // Fallback to just the text if place details fails
      onSelect({
        address: suggestion.text,
        placeId: suggestion.placeId,
      })
    } finally {
      setLoading(false)
    }
  }, [onSelect])

  // debounce input
  useEffect(() => {
    if (abortRef.current) window.clearTimeout(abortRef.current)
    abortRef.current = window.setTimeout(() => { fetchSuggestions(value) }, 250)
    return () => { if (abortRef.current) window.clearTimeout(abortRef.current) }
  }, [value, fetchSuggestions])

  return (
    <div className="relative">
      <Input
        placeholder="e.g., 123 Main Street, Manchester"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-gray-300"
      />

      {loading && <div className="absolute right-2 top-2 text-xs text-muted-foreground">Loading…</div>}

      {suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded shadow-sm max-h-48 overflow-auto">
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectPlace(s)}
              className="p-2 cursor-pointer hover:bg-muted"
            >
              {s.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
