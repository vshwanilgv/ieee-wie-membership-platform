'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Home, 
  User, 
  Award, 
  CheckSquare, 
  Bell, 
  Trophy, 
  Shield,
  LogOut,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface NavItem {
  name: string
  href: string
  icon: any
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'My Profile', href: '/dashboard/profile', icon: User },
  { name: 'Contributions', href: '/dashboard/contributions', icon: Award },
  { name: 'Approvals', href: '/dashboard/approvals', icon: CheckSquare },
  { name: 'Role Management', href: '/dashboard/roles', icon: Shield },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Notifications', href: '/dashboard/notifications', icon: Bell },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
      router.push('/auth/login')
      router.refresh()
    } catch (error: any) {
      toast.error('Failed to sign out')
    }
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-purple-700 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <h1 className="text-white text-xl font-bold">IEEE WIE UoM</h1>
          </div>
          <div className="mt-8 flex-1 flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-purple-800 text-white'
                        : 'text-purple-100 hover:bg-purple-600'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
            <div className="px-2 pb-4">
              <button
                onClick={handleSignOut}
                className="group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md text-purple-100 hover:bg-purple-600"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-purple-700 px-4 py-3">
          <h1 className="text-white text-lg font-bold">IEEE WIE UoM</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 bg-purple-700 pt-16">
            <nav className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-4 py-3 text-base font-medium rounded-md ${
                      isActive
                        ? 'bg-purple-800 text-white'
                        : 'text-purple-100 hover:bg-purple-600'
                    }`}
                  >
                    <Icon className="mr-3 h-6 w-6" />
                    {item.name}
                  </Link>
                )
              })}
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleSignOut()
                }}
                className="flex items-center w-full px-4 py-3 text-base font-medium rounded-md text-purple-100 hover:bg-purple-600"
              >
                <LogOut className="mr-3 h-6 w-6" />
                Sign Out
              </button>
            </nav>
          </div>
        )}
      </div>
    </>
  )
}
