import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { ProfileFormValues } from './DashboardComponents'
import { CreateProfileForm, ProfilePanel } from './DashboardComponents'
import { ProfileSwitcher } from './ProfileSwitcher'
import type { UserProfile } from '../types'
import {
  clubEventTypes,
  clubInterests,
  clubResources,
  collaborationOptions,
} from './clubDiscoveryOptions'

interface ProfilePageProps {
  activeProfile: UserProfile | null
  profiles: UserProfile[]
  authUserId: string | null
  authDisplayName: string | null
  authPhotoUrl: string | null
  authEmail: string | null
  isAnonymousSession: boolean
  isGoogleAccount: boolean
  profileForm: ProfileFormValues
  editProfileForm: ProfileFormValues
  isCreatingProfile: boolean
  onSelectProfile: (profileId: string) => void
  onCreateProfileStart: () => void
  onCreateProfile: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onProfileFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onEditProfileStart: () => void
  onEditProfileSave: (event: FormEvent<HTMLFormElement>) => Promise<boolean>
  onEditProfileFieldChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void
  onOrganizationSettingsChange: (
    field:
      | 'interests'
      | 'eventTypes'
      | 'availableResources'
      | 'collaborationPreferences'
      | 'directoryVisible',
    value: string[] | boolean,
  ) => void
  onContinueWithoutEmail: () => void
  onGoogleSignIn: () => void
  onSignOut: () => void
}

export const ProfilePage = ({
  activeProfile,
  profiles,
  authUserId,
  authDisplayName,
  authPhotoUrl,
  authEmail,
  isAnonymousSession,
  isGoogleAccount,
  profileForm,
  editProfileForm,
  isCreatingProfile,
  onSelectProfile,
  onCreateProfileStart,
  onCreateProfile,
  onProfileFieldChange,
  onEditProfileStart,
  onEditProfileSave,
  onEditProfileFieldChange,
  onOrganizationSettingsChange,
  onContinueWithoutEmail,
  onGoogleSignIn,
  onSignOut,
}: ProfilePageProps) => {
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    if (await onCreateProfile(event)) setIsCreating(false)
  }

  const handleEditProfile = async (event: FormEvent<HTMLFormElement>) => {
    if (await onEditProfileSave(event)) setIsEditing(false)
  }

  const handleProfileSwitch = (profileId: string) => {
    onSelectProfile(profileId)
    setIsEditing(false)
    setIsCreating(false)
  }

  const toggleOrganizationOption = (
    field: 'interests' | 'eventTypes' | 'availableResources' | 'collaborationPreferences',
    option: string,
    checked: boolean,
  ) => {
    const currentValues = editProfileForm[field] ?? []
    onOrganizationSettingsChange(
      field,
      checked
        ? [...currentValues, option]
        : currentValues.filter((value) => value !== option),
    )
  }

  const organizationOptions = [
    { field: 'interests' as const, label: 'Interest categories', options: clubInterests },
    { field: 'eventTypes' as const, label: 'Preferred event types', options: clubEventTypes },
    {
      field: 'availableResources' as const,
      label: 'Available resources',
      options: clubResources,
    },
    {
      field: 'collaborationPreferences' as const,
      label: 'Collaboration preferences',
      options: collaborationOptions,
    },
  ]

  return (
    <section className="space-y-6" aria-labelledby="profile-page-heading">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-blue-600">Your CoHost profile</p>
        <h2 id="profile-page-heading" className="mt-1 text-3xl font-bold text-slate-900">
          Profile
        </h2>
        <p className="mt-2 text-slate-600">
          Manage the student and organization profiles attached to your Firebase account.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.8fr)]">
        <div className="space-y-6">
          {isEditing && activeProfile ? (
            <section className="panel" aria-labelledby="edit-profile-heading">
              <div className="mb-5">
                <p className="text-sm font-semibold text-blue-700">Profile settings</p>
                <h3 id="edit-profile-heading" className="mt-1 text-2xl font-bold text-slate-900">
                  Edit Profile
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Update the details shown on your active profile.
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleEditProfile}>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Name</span>
                  <input
                    aria-label="Profile name"
                    name="name"
                    value={editProfileForm.name}
                    onChange={onEditProfileFieldChange}
                    className="input"
                    required
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Interests</span>
                  <select
                    aria-label="Profile interests"
                    name="focus"
                    value={editProfileForm.focus}
                    onChange={onEditProfileFieldChange}
                    className="input"
                  >
                    <option>General club activities</option>
                    <option>Martial arts and team events</option>
                    <option>Outdoor and recreation</option>
                    <option>STEM and maker projects</option>
                    <option>Arts and cultural programming</option>
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Location</span>
                  <input
                    aria-label="Profile location"
                    name="location"
                    value={editProfileForm.location}
                    onChange={onEditProfileFieldChange}
                    className="input"
                    required
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  <span>Description</span>
                  <textarea
                    aria-label="Profile description"
                    name="description"
                    value={editProfileForm.description}
                    onChange={onEditProfileFieldChange}
                    className="input min-h-28"
                  />
                </label>
                {activeProfile.profileType === 'organization' ? (
                  <>
                    {organizationOptions.map(({ field, label, options }) => (
                      <fieldset key={field} className="space-y-2">
                        <legend className="text-sm font-semibold text-slate-800">{label}</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {options.map((option) => (
                            <label
                              key={option}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={(editProfileForm[field] ?? []).indexOf(option) !== -1}
                                onChange={(changeEvent) =>
                                  toggleOrganizationOption(
                                    field,
                                    option,
                                    changeEvent.target.checked,
                                  )
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                    <label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                      <input
                        type="checkbox"
                        checked={editProfileForm.directoryVisible ?? false}
                        onChange={(event) =>
                          onOrganizationSettingsChange('directoryVisible', event.target.checked)
                        }
                      />
                      <span>
                        <span className="block font-semibold">Show in Discover Clubs</span>
                        <span className="mt-1 block text-violet-800">
                          Only the club details and collaboration information above will be public.
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="submit" className="button-primary">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <ProfilePanel
              activeProfile={activeProfile}
              authUserId={authUserId}
              authDisplayName={authDisplayName}
              authPhotoUrl={authPhotoUrl}
              authEmail={authEmail}
              isAnonymousSession={isAnonymousSession}
              isGoogleAccount={isGoogleAccount}
            />
          )}
        </div>

        <aside className="space-y-5">
          <section className="panel space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Manage profiles</h3>
            <p className="text-sm text-slate-600">
              Profiles are separate identities under your current Firebase account.
            </p>
            <div className="flex flex-col gap-3">
              <ProfileSwitcher
                profiles={profiles}
                activeProfile={activeProfile}
                onSelectProfile={handleProfileSwitch}
              />
              {activeProfile ? (
                <button
                  type="button"
                  className="rounded-full border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700 transition hover:bg-blue-100"
                  onClick={() => {
                    onEditProfileStart()
                    setIsCreating(false)
                    setIsEditing(true)
                  }}
                >
                  Edit Profile
                </button>
              ) : null}
              <button
                type="button"
                className="button-primary w-full"
                onClick={() => {
                  onCreateProfileStart()
                  setIsEditing(false)
                  setIsCreating(true)
                }}
              >
                Create New Profile
              </button>
            </div>
          </section>

          <section className="panel space-y-3" aria-labelledby="account-access-heading">
            <div>
              <h3 id="account-access-heading" className="text-lg font-bold text-slate-900">
                Account access
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {authUserId
                  ? isAnonymousSession
                    ? 'You are using Firebase Anonymous Authentication. Connecting Google links this session when possible.'
                    : `Signed in${isGoogleAccount ? ' with Google' : ' to Firebase'}${authDisplayName ? ` as ${authDisplayName}` : ''}. Profile switching does not change this account.`
                  : 'Your local profile is not signed in to Firebase yet.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!authUserId ? (
                <button
                  type="button"
                  className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                  onClick={onContinueWithoutEmail}
                >
                  Continue without email
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700"
                onClick={onGoogleSignIn}
              >
                {authUserId ? 'Connect Google account' : 'Sign in with Google'}
              </button>
              {authUserId ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={onSignOut}
                >
                  Sign Out
                </button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {isCreating ? (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCreatingProfile) {
              setIsCreating(false)
              onCreateProfileStart()
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-profile-heading"
            className="panel profile-modal"
          >
            <div className="mb-5">
              <p className="text-sm font-semibold text-blue-700">New profile</p>
              <h3 id="create-profile-heading" className="mt-1 text-2xl font-bold text-slate-900">
                Create a Profile
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Choose whether to represent yourself as a student or an organization.
              </p>
            </div>
            <CreateProfileForm
              profileForm={profileForm}
              onFieldChange={onProfileFieldChange}
              onSubmit={(event) => void handleCreateProfile(event)}
              isSubmitting={isCreatingProfile}
              showHeading={false}
            />
            <button
              type="button"
              className="mt-3 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                onCreateProfileStart()
                setIsCreating(false)
              }}
              disabled={isCreatingProfile}
            >
              Cancel
            </button>
          </section>
        </div>
      ) : null}
    </section>
  )
}
