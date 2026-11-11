# CoHost clean Spark V2 launch

This is the current launch checklist. It supersedes historical Test 1/migration readiness reports. No historical data needs migration; do not run freeze/apply migration commands or restore old exports for this launch.

## Verified reset and release state

Read-only production audit on 2026-11-07 at 01:53 CST / 07:53 UTC found zero documents in events, cohostRequests, participationRequests, userProfiles, eventTitleReservations, eventCollaboration, eventMigrationLocks, organizationAccounts and publicOrganizations. A read-only root collection metadata scan returned no root collections, nested collections or missing parent documents. Thus no stale title reservation, old accounting tombstone, orphan request or orphan subcollection was found. These are audit-time results; recheck before release if anyone has used the live site since then.

Production project remains cohost-8fdc0 on the existing Spark setup; no billing changes were made. Live Hosting is dc90f13569d0c456. Active Firestore ruleset is 8bfbd694-ef72-4cca-bf7b-56a8ed736bab and has no V2 accounting. The old frontend remains incompatible with secure discovery and V2 writes. Production must receive the tested local Rules before a true V2 frontend starts creating events.

## Verified workflow from an empty database

src/services/cleanLaunch.emulator.test.ts imports the actual cohost client service functions and substitutes only the emulator database/authenticated test identity. It starts empty without Admin seeding of events or requests, historical data, Functions or migration tools.

1. Save organization profiles: private profile and owner marker are created atomically. New profiles stay directory-private until explicitly opted in.
2. Create a Draft event with V2 creation enabled: event and title reservation and accounting baseline are written in the same transaction. Accounting is pendingCount=0, totalRequests=0, acceptedCount=0, partnerProfileIds=[], lastRequestId='', revision=0; confirmedCoHosts=[].
3. Start Collaboration: Draft -> Pending Collaboration. Students remain unable to read it.
4. Verified organizations submit requests using accounting transactions. Multiple requests are supported; declines remain history without consuming partner capacity.
5. Host accepts one request and declines another. Acceptance verifies the current organization and appends exactly its public attribution; counters remain consistent. Completion with pending requests fails.
6. Complete Collaboration: zero pending -> Ready to Publish with explicit completion true. A stale dashboard edit cannot erase fresh attribution.
7. Manual Publish Event confirmation -> Published through Firestore client transaction and Rules, never a callable.
8. Student Published-only query returns the event and confirmedCoHosts. Existing Hosted By UI tests verify primary/co-host display. Private request negotiations remain unreadable to students.
9. Student submits a one-person participation request; host acceptance increments attendance atomically.

The existing Rules suite additionally covers unauthorized publishing/approval, forged/duplicate/missing attribution, accounting tampering, third/later requests, contention and eight accepted partners with ninth rejection. No security Rules changes/exceptions were introduced for this clean launch.

## Reset-safe profile recovery

- ensureOrganizationAccount reads the current cloud identity and never overwrites newer profile fields from cached local values.
- It recovers a missing account marker. For directoryVisible=true, it recovers the public listing from cloud values; missing optional directory arrays are filled from cloud defaults inside the same transaction. It does not opt private profiles in. Directory opt-out removes any stale listing.
- Organization saves use the synchronized directory/profile service, so explicit profile saves also maintain listing consistency.
- Authoritative server profile snapshots replace the device's profile list. Profiles removed during the reset are not kept selected indefinitely or silently recreated from authenticated-user cache entries.
- Cache-only profile snapshots are not treated as authoritative deletions. Malformed local profile cache repairs only CoHost profile/active-profile keys, never Firebase Auth or device identity.
- Sign-in/profile creation no longer bulk-overwrites already cloud-owned profiles from stale device copies. Only genuinely device-owned unsynced profiles are initially synchronized; newly created profiles are saved explicitly.
- Cancelled bootstrap attempts do not display stale errors after selection changes. After a full reset, returning users create new cloud profiles under their existing authenticated UID. Do not clear site data, IndexedDB, local storage or anonymous auth sessions.

## No historical or backend dependency

Frontend source has no firebase/functions imports, getFunctions or httpsCallable calls. publishEvent is now a Firestore service function name, not a callable. Runtime source imports no migration script or firebase-admin module. firebase.json no longer contains a Functions deployment entry. Historical functions/ and migration scripts remain reference/operator files and are neither bundled nor required by npm run test:rules. Missing ADC credentials from the earlier migration audit are NOT a clean-launch blocker.

Legacy protocol guards remain fail-closed for unexpected documents. They do not make clean V2 events depend on migration. Fresh events use new random IDs; historical accounting records or cached old event objects are not reused.

## Production flag and artifact

.env.production contains VITE_PUBLICATION_V2_ENABLED=true. Vite reads it for the production build. An explicitly set shell variable can override an env file, so the artifact inspection must also pass: the built event-creation code must contain collaborationVersion:2 and must not contain the compatibility creation branch cohostRequestIds:[].

The explicit build command is:

```powershell
$env:VITE_PUBLICATION_V2_ENABLED='true'
npm.cmd run build
```

The flag is baked into JavaScript; changing an environment variable after build does not change deployed content. VITE_PUBLICATION_V2_ENABLED=false is not the launch setting. Development mode can opt in with the same shell variable before npm run dev.

Private audit evidence, frozen copies of the final build, narrowly scoped Hosting configs and SHA-256 hashes are in .firebase/clean-launch-2026-11-07. They are Git-ignored and outside Hosting's public folder. Do not use the older readiness-2026-11-07 migration-era artifacts. Root firebase.json serves dist, has the SPA rewrite, and deploys no Functions. The explicit clean-launch Hosting config serves only frontend-v2, never its sibling audit files.

## Validation

Run with Java 21 for the Firestore emulator:

```powershell
npm.cmd run build
npm.cmd run lint
npx.cmd vitest run --exclude src/services/firestoreRules.emulator.test.ts --exclude src/services/firestoreCompatibility.emulator.test.ts --exclude src/services/cleanLaunch.emulator.test.ts
npm.cmd run test:rules
```

The Rules command runs the baseline, compatibility-safety and actual-service clean-launch tests sequentially. Historical migration scripts/admin dependencies are not invoked. Current validation: build/lint passed, 87 application/service/cache tests passed, and 60 Firestore emulator tests passed (35 baseline + 22 compatibility-safety + 3 clean-launch). Build has the existing bundle-size warning.

## Deployment gates and maintenance procedure

No deploy was performed. Technical result: GO for the tested clean V2 implementation and production artifact. Execution requires explicit release authorization and these gates:

- [ ] Confirm the project and recorded active Rules/Hosting versions have not drifted. Recheck that event/request/reservation/control collections are still empty. Do not silently delete newly discovered records.
- [ ] Approve a low-traffic maintenance window (allow 30?45 minutes plus an observation period) and an operator/abort deadline.
- [ ] Preserve the active Rules/Hosting metadata and current audited empty-state evidence securely. Keep historical backups separate and never restore them into this reset.
- [ ] Confirm the final artifact manifest, production flag and source Rules hash. No Functions deployment or billing operation is part of this plan.
- [ ] Ensure release CLI credentials are valid; if the earlier exposed CLI session has not been revoked/refreshed, perform that credential hygiene before release. Browser/Firebase Auth users must not be signed out for this purpose.
- [ ] Approve any controlled production smoke-test data separately; no smoke-test writes were performed during preparation.

Sequence:

1. Show the prepared maintenance page and ask users to close old CoHost tabs. This does not terminate already open sessions. Never clear account storage or discard anonymous UIDs.
2. Deploy the proposed Firestore Rules only. Wait for propagation and verify the active ruleset/source. Do not rely on the management API update alone as immediate client enforcement.
3. Verify in a fresh session that protected reads remain denied and required protocol operations behave as expected. Use explicitly authorized canary/test records if production write checks are needed.
4. Deploy the prepared V2 Hosting artifact. Hosting and Rules deployments are separate, not atomic.
5. Verify the exact entry asset and fresh-browser profile state, then let users create new organization/student profiles. Directory opt-in is explicit.
6. With authorized smoke-test users, exercise Draft -> Start Collaboration -> request submission/acceptance/decline -> completion -> publication -> Hosted By -> student participation and host approval. Confirm initialized accounting and privacy before ending maintenance.
7. Observe permission errors, failed bootstrap, contention and cached-page failures through the agreed observation period.

Expected privacy checks: students see no Draft/Pending/Ready events and cannot submit participation requests to them; direct private request reads are denied. Confirmed co-hosts are accepted, verified and unique; declines do not appear. There is no automatic publish on acceptance.

## Exact deployment commands ? reference only after the gates are approved

From C:\Users\24419\Desktop\CoHost:

```powershell
firebase deploy --only hosting --project cohost-8fdc0 --config .firebase/clean-launch-2026-11-07/hosting-maintenance.json
firebase deploy --only firestore:rules --project cohost-8fdc0
```

STOP and verify Rules propagation/privacy before the next command:

```powershell
firebase deploy --only hosting --project cohost-8fdc0 --config .firebase/clean-launch-2026-11-07/hosting-v2.json
```

Do not run migration/freeze/apply commands, deploy Functions, change billing, or use broad firebase deploy. The production artifact is already built true; do not overwrite it with a false build before release.

## Rollback and remaining limits

On failed verification, serve the maintenance artifact and keep the secure V2 Rules. Do not restore the old incompatible frontend or historical Firestore exports. Once users create V2 data, never roll Rules back to a pre-accounting version that permits unaccounted requests. Retain all new user data; review and roll forward. A compatible V2 release can replace the maintenance page after repair.

Known limits remain eight confirmed organizations, shared-control contention requiring retries, Spark quotas, explicit directory opt-in, and acceptance-time partner names. Accepted partnership withdrawal/replacement is not implemented. These do not prevent the tested clean workflow. No application/data blocker was found in the reset audit; production still needs the Rules and Hosting release, and real post-deployment smoke checks remain unperformed by design.
