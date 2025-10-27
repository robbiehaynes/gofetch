import { Card } from "@/components/ui/card"

import { Clock, MapPin, Zap } from "lucide-react"

export function Features() {
  const features = [
    {
      title: "Perfect Timing",
      description: "Track arrivals in real-time with up-to-the-minute updates from trains and flights.",
      icon: (
        <Clock className="h-10 w-10 text-primary" />
      )
    },
    {
      title: "Live Updates",
      description: "Get intelligent arrival time predictions that account for traffic and historical patterns.",
      icon: (
        <MapPin className="h-10 w-10 text-primary" />
      ),
    },
    {
      title: "Smart Notifications",
      description: "Receive timely alerts about delays, early arrivals, or changes to the schedule.",
      icon: (
        <Zap className="h-10 w-10 text-primary" />
      ),
    },
  ]

  return (
    <section className="container mx-auto px-6 py-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((feature) => (
          <Card key={feature.title} className="p-10">
            <div className="flex flex-col items-center text-center gap-4">
              {feature.icon}
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}