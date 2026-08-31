import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import SidebarClient from "@/components/sidebar"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/30">
      <SidebarClient
        userName={session.user.name || ""}
        userRole={session.user.role || "VIEWER"}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
