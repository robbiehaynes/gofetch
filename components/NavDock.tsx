import Dock from "@/components/Dock";
import { House, CircleUserRound, Settings } from "lucide-react";
import { div } from "motion/react-client";

const items = [
  { icon: <House />, label: "Home", onClick: () => console.log("Home clicked") },
  { icon: <CircleUserRound />, label: "Account", onClick: () => console.log("Profile clicked") },
  { icon: <Settings />, label: "Settings", onClick: () => console.log("Settings clicked") },
]

export default function NavDock() {
  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50">
      <Dock
        className="shadow-sm"
        items={items}
        panelHeight={40}
        baseItemSize={50}
        magnification={60}
      />
    </div>
  )
}