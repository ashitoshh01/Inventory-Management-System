import { Settings as SettingsIcon } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your system preferences</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-white px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
          <SettingsIcon className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">System Settings</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Company profile, currency, tax, and notification settings will be available in Phase 2.
        </p>
        <span className="mt-4 inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
          Coming in Phase 2
        </span>
      </div>
    </div>
  )
}
