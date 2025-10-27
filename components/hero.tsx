import Image from "next/image"

import { AuthButton } from "@/components/auth-button"
import { ThemeSwitcher } from "./theme-switcher"

export function Hero() {
  return (
    <div className="container mx-auto px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Column - Text Content */}
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Smart timing for every pickup.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Arrive at exactly the right time to pick someone up from a train station or airport using real-time arrival data and predictive analysis.
          </p>
          <div className="flex gap-4">
            <AuthButton />
            <ThemeSwitcher />
          </div>
        </div>

        {/* Right Column - Image (hidden on mobile) */}
        <div className="hidden md:block">
          <div className="relative h-[600px] w-full">
            <Image
              src="/figure.webp"
              alt="GoFetch Figure"
              width={600}
              height={600}
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
