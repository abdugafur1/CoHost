import type { UserProfile } from '../types'

export const WorkspaceHome = ({ profile }: { profile: UserProfile | null }) => (
  <section className="workspace-home" aria-labelledby="welcome-title">
    <p className="eyebrow">Campus plans start here</p>
    <h2 id="welcome-title">What would you like to do?</h2>
    <p className="welcome-copy">{profile ? `Welcome, ${profile.name}. ` : ''}
      Pick a path. We’ll guide you through the rest, one step at a time.</p>
    <div className="intent-options">
      <a href="#events" className="intent-card">
        <span className="intent-number" aria-hidden="true">01</span>
        <h3>Find an event</h3>
        <p>Explore campus events, choose one, and request to join.</p>
        <span className="text-link">Start exploring <span aria-hidden="true">→</span></span>
      </a>
      <a href="#host" className="intent-card">
        <span className="intent-number" aria-hidden="true">02</span>
        <h3>Create an event</h3>
        <p>Bring your club’s idea to life. Add the details at your own pace.</p>
        <span className="text-link">Start planning <span aria-hidden="true">→</span></span>
      </a>
    </div>
    <p className="home-footnote">Already have plans? <a href="#inbox">Check your inbox</a>
      {profile?.profileType === 'organization' ? <> or <a href="#manage">manage your events</a></> : null}.</p>
  </section>
)
