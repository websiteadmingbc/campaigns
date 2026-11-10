import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, ClipboardList, LayoutDashboard, LogOut, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarDays },
  { to: '/daily-entry', label: 'Daily Entry', icon: ClipboardList, adminOnly: true },
  { to: '/campaigns/new', label: 'New Campaign', icon: Plus, adminOnly: true },
]

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-black/20 bg-[var(--color-header)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Great Britton Construction" className="h-9 w-auto" />
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {nav
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <div className="hidden sm:block text-right">
              <p className="font-medium leading-tight">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-white/60 capitalize">{profile?.role}</p>
            </div>
            <Button
              variant="ghost"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() => signOut()}
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-3">
          {nav
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="no-print border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-ink-muted)]">
        Great Britton Construction · Campaign Tracker
      </footer>
    </div>
  )
}
