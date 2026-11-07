import { useState } from 'react'
import type { UserProfile } from '../types'

interface ProfileSwitcherProps {
  profiles: UserProfile[]
  activeProfile: UserProfile | null
  onSelectProfile: (profileId: string) => void
}

export const ProfileSwitcher = ({
  profiles,
  activeProfile,
  onSelectProfile,
}: ProfileSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Switch between profiles belonging to the current Firebase account"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
      >
        Switch Profile
      </button>
      {isOpen ? (
        <div
          role="listbox"
          aria-label="Available profiles"
          className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {profiles.length ? (
            profiles.map((profile) => {
              const isSelected = activeProfile?.id === profile.id
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="option"
                  aria-label={`${profile.name} ${profile.profileType}`}
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectProfile(profile.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                    isSelected
                      ? profile.profileType === 'student'
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-violet-50 text-violet-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{profile.name}</span>
                    <span
                      className={`mt-0.5 block text-xs capitalize ${
                        profile.profileType === 'student' ? 'text-blue-700' : 'text-violet-700'
                      }`}
                    >
                      {profile.profileType}
                    </span>
                  </span>
                  {isSelected ? <span aria-hidden="true">✓</span> : null}
                </button>
              )
            })
          ) : (
            <p className="px-3 py-4 text-sm text-slate-500">
              No profiles yet. Create a profile to get started.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
