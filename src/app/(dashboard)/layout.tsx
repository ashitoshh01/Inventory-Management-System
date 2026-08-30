import { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/lib/auth"
import { can } from "@/lib/permissions"
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
} from "lucide-react"

const NAV_ITEMS = [
  { name: "Products", href: "/products", icon: Package, resource: "products" },
  { name: "Warehouses", href: "/warehouses", icon: Warehouse, resource: "warehouses" },
  { name: "Stock", href: "/stock", icon: Boxes, resource: "stock" },
  { name: "Purchasing", href: "/purchasing", icon: ShoppingCart, resource: "purchasing" },
  { name: "Sales", href: "/sales", icon: Receipt, resource: "sales" },
  { name: "POS", href: "/pos", icon: Store, resource: "pos" },
  { name: "Reports", href: "/reports", icon: LineChart, resource: "reports" },
  { name: "Users", href: "/users", icon: Users, resource: "users" },
  { name: "Settings", href: "/settings", icon: Settings, resource: "settings" },
]

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }

  const allowedNavItems = NAV_ITEMS.filter(item => can(session, "read", item.resource))

  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-gray-50">
      <aside className="w-full md:w-64 bg-white border-r flex flex-col h-full">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">IMS Dashboard</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {allowedNavItems.map(item => {
            const Icon = item.icon
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <Icon className="h-5 w-5 text-gray-400" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t flex flex-col gap-2">
          <div className="text-sm font-medium text-gray-900 truncate">
            {session.user.name}
          </div>
          <div className="text-xs text-gray-500 truncate mb-2">
            {session.user.role}
          </div>
          <form action={async () => {
            "use server"
            await signOut()
          }}>
            <button className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:bg-red-50">
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
