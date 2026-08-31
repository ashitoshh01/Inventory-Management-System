"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Package,
  Warehouse,
  Boxes,
  ShoppingCart,
  Receipt,
  Store,
  LineChart,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const NAV_ITEMS = [
  { name: "Products", href: "/products", icon: Package },
  { name: "Warehouses", href: "/warehouses", icon: Warehouse },
  { name: "Stock", href: "/stock", icon: Boxes },
  { name: "Purchasing", href: "/purchasing", icon: ShoppingCart },
  { name: "Sales", href: "/sales", icon: Receipt },
  { name: "POS", href: "/pos", icon: Store },
  { name: "Reports", href: "/reports", icon: LineChart },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface SidebarClientProps {
  userName: string
  userRole: string
}

export default function SidebarClient({ userName, userRole }: SidebarClientProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/products") {
      return pathname === "/products" || pathname.startsWith("/products/")
    }
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">Inventory</h1>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-100",
                active
                  ? "bg-primary text-primary-foreground shadow-sm shadow-teal-200/50"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn(
                "h-[18px] w-[18px] shrink-0",
                active ? "text-primary-foreground" : "text-muted-foreground/70 group-hover:text-foreground"
              )} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground uppercase">
            {userName?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{userName || "User"}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{userRole?.toLowerCase().replace("_", " ") || "viewer"}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            // Use signOut from next-auth/react
            const { signOut } = await import("next-auth/react")
            signOut({ callbackUrl: "/login" })
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex md:hidden h-10 w-10 items-center justify-center rounded-lg border bg-white shadow-sm"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-border/50 transition-transform duration-200 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
