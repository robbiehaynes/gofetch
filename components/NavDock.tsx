import Dock from "@/components/Dock";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { House, CircleUserRound, Settings, Edit, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer" 
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

function AccountDrawerContent({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [origDisplayName, setOrigDisplayName] = useState("");
  const [origEmail, setOrigEmail] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    let mounted = true
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user
        if (!user || !mounted) return
        const metaName = (user.user_metadata as any)?.display_name || ""
        setDisplayName(metaName)
        setOrigDisplayName(metaName)
        setEmail(user.email || "")
        setOrigEmail(user.email || "")
        console.log('Loaded user')
      } catch (err) {
        console.error('Failed to load user:', err)
      }
    }
    loadUser()
    return () => { mounted = false }
  }, [])

  const saveField = async () => {
    try {
      setSavingName(true)
      setSavingEmail(true)

      // Update email if it changed
      if (email !== origEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email })
        if (emailError) throw emailError
      }

      // Update display name if it changed
      if (displayName !== origDisplayName) {
        const { error: nameError } = await supabase.auth.updateUser({
          data: { display_name: displayName }
        })
        if (nameError) throw nameError
      }

      setOrigDisplayName(displayName)
      setOrigEmail(email)
      setEditingName(false)
      setEditingEmail(false)
    } catch (err) {
      console.error('Error updating user:', err)
      // Revert changes on error
      setDisplayName(origDisplayName)
      setEmail(origEmail)
    } finally {
      setSavingName(false)
      setSavingEmail(false)
    }
  }

  return (
    <>
      <div className="p-4 pb-0 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-2">
            <Label className="text-sm">Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!editingName}
            />
          </div>
          <div className="flex items-start pt-6">
            {!editingName ? (
              <Button variant="ghost" size="sm" className="min-h-9" onClick={() => setEditingName(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="min-h-9" onClick={saveField} disabled={savingName}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="min-h-9" onClick={() => { setDisplayName(origDisplayName); setEditingName(false) }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex-1 mr-2">
            <Label className="text-sm">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!editingEmail}
            />
          </div>
          <div className="flex-shrink-0 flex items-start pt-6">
            {!editingEmail ? (
              <Button variant="ghost" size="sm" className="min-h-9" onClick={() => setEditingEmail(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="min-h-9" onClick={saveField} disabled={savingEmail}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="min-h-9" onClick={() => { setEmail(origEmail); setEditingEmail(false) }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <DrawerFooter className="mt-4">
        <Button onClick={onClose}>Close</Button>
      </DrawerFooter>
    </>
  )
}

export default function NavDock() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [updateFrequency, setUpdateFrequency] = useState("1");
  const [localOnlyMode, setLocalOnlyMode] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const settings = localStorage.getItem("gofetch_settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      setNotificationsEnabled(parsed.notificationsEnabled ?? true);
      setUpdateFrequency(parsed.updateFrequency ?? "1");
      setLocalOnlyMode(parsed.localOnlyMode ?? false);
    }
  }, []);

  const handleSaveSettings = () => {
    const settings = {
      notificationsEnabled,
      updateFrequency: parseInt(updateFrequency),
      localOnlyMode
    };
    localStorage.setItem("gofetch_settings", JSON.stringify(settings));
    setIsSettingsDrawerOpen(false);

    // Request notification permission if enabled
    if (notificationsEnabled && "Notification" in window) {
      Notification.requestPermission();
    }

    // Dispatch custom event for dashboard to pick up changes
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: settings }));
  };

  const items = [
    { icon: <House />, label: "Home", onClick: () => setIsDialogOpen(true) },
    { icon: <CircleUserRound />, label: "Account", onClick: () => setIsAccountDrawerOpen(true) },
    { icon: <Settings />, label: "Settings", onClick: () => setIsSettingsDrawerOpen(true) },
  ]

  return (
    <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-50">
      {isDialogOpen && (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will take you back to the home page and away from the dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => router.push("/")}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isAccountDrawerOpen && (
        <Drawer open={isAccountDrawerOpen} onOpenChange={setIsAccountDrawerOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle>Account</DrawerTitle>
                <DrawerDescription>Update your account settings</DrawerDescription>
              </DrawerHeader>
              <AccountDrawerContent onClose={() => setIsAccountDrawerOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {isSettingsDrawerOpen && (
        <Drawer open={isSettingsDrawerOpen} onOpenChange={setIsSettingsDrawerOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle>Settings</DrawerTitle>
                <DrawerDescription>Update your user preferences</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 pb-0 space-y-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="notifications" 
                    checked={notificationsEnabled}
                    onCheckedChange={(checked) => setNotificationsEnabled(checked as boolean)}
                  />
                  <Label htmlFor="notifications">Enable Notifications</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Update Frequency (minutes)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    min="1"
                    value={updateFrequency}
                    onChange={(e) => setUpdateFrequency(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">Minimum 1 minute</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="localOnly" 
                    checked={localOnlyMode}
                    onCheckedChange={(checked) => setLocalOnlyMode(checked as boolean)}
                  />
                  <Label htmlFor="localOnly">Local Only Mode</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Select Theme</Label><br />
                  <ThemeSwitcher />
                </div>
              </div>
              <DrawerFooter className="mt-4">
                <Button onClick={handleSaveSettings}>Save</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>)}
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