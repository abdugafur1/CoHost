> Historical rollout record: the production test data has since been reset. Use [spark-clean-launch.md](spark-clean-launch.md) for the current clean V2 launch. Do not run historical migration commands for this launch.

# Spark publication: verified request accounting (version 2)

Status: implemented locally; no deployment or production data changes. Spark remains unchanged. No runtime Cloud Functions are used. Historical Functions files remain for reference only.

## Data and security invariant

New opted-in events carry `collaborationVersion: 2` and `confirmedCoHosts: []`. The public snapshot remains `Array<{profileId: string, name: string}>`; the existing student Hosted By display reads this same field.

`eventCollaboration/{eventId}` contains only `pendingCount`, `totalRequests`, `acceptedCount`, `partnerProfileIds`, `lastRequestId`, and `revision`. Requests and negotiation text remain in the private `cohostRequests` collection. Students cannot read control documents. Organization owners may read control documents while events are open; hosts can read their own controls at every stage.

The trusted baseline is established either atomically with creation of a new event or by an explicitly authorized migration. Clients cannot initialize controls for existing events, change event protocol versions, or reset/delete controls. Controls remain as tombstones if an empty event is deleted. Events with request history must be cancelled, preserving every request and event.

Each submission or resolution changes exactly one request per event and advances control revision once. Both the request and control rules check the request pointer, status transition and count delta using getAfter(). Two requests cannot reuse one increment/decrement. There is no fixed lifetime request limit. Declined requests remain unchanged history and consume no confirmed partner capacity.

- Submit: verified organization creates a pending request and increments pendingCount and totalRequests. Both before and after event state must remain Pending Collaboration.
- Decline: only the host resolves a pending request and decrements pendingCount; accepted count, partner IDs and public attribution remain unchanged.
- Accept: only the host resolves a pending request, verifies its current organization identity and exact request-time name, decrements pendingCount, increments acceptedCount, appends its unique profile ID, and appends exactly its verified public attribution to the existing array. Omitting attribution, forging a name, reusing an approval, or adding a ninth partner is rejected.
- Complete: owner explicitly marks completion, requires zero pending requests and valid version-2 control, and moves Pending Collaboration to Ready to Publish. Closing the event blocks new submissions. A concurrent submission and completion cannot both leave a ready event with pending requests.
- Publish: manual confirmation remains required. Only the verified hosting owner can move Ready to Publish to Published, with completion true and zero pending requests. Attribution does not change during publication: integrity was established at each acceptance.

The maximum is eight distinct confirmed organizations. This bound is tested through eight successive approvals and publication, and a rejected ninth approval. Intake can continue beyond eight requests: the host can decline excess requests. Declined requests never use a partner slot. Accepted partnerships are immutable in this release; withdrawal/replacement would require a separately designed verified protocol.

Rules inspect a bounded set of documents for the current operation, not every historical request or every accepted partner. Existing array contents are preserved by exact append equality, and unique partner IDs are enforced by control list equality and set size. Emulator tests exercise the maximum snapshot size, accounting tampering and multi-request bypasses; frontend tests alone are not security validation.

## Workflow and privacy

Draft -> Pending Collaboration -> Ready to Publish -> Published. Ready may reopen to Pending Collaboration, and owners can cancel at any stage. No automatic publication on approval. Students query only explicit Published status and participation writes require Published, audience everyone, remaining capacity and matching student/host identities. Missing legacy status is Draft, never automatically public.

Organization means an account with an owned organization profile, not institutional accreditation. Anonymous and Google-link ownership behavior remains unchanged. ensureOrganizationAccount now reads and verifies the cloud profile inside a transaction and writes only the organizationAccounts marker. It never rewrites the profile from stale local data. Missing cloud profiles require explicit sync/recovery; bootstrap errors are surfaced before discovery starts.

## Legacy compatibility and rollout gate

`VITE_PUBLICATION_V2_ENABLED` defaults OFF. Only a build with the exact value `true` opts newly created events into version 2. This is an operational rollout gate, not an authorization mechanism: Rules enforce either protocol regardless of frontend flags. Tests run both payloads.

Legacy events without collaborationVersion retain owner reads, owner edits, accepted request history and pending-stage submission/review. Direct legacy request creates and the earlier registry-appending atomic payload are supported. The old cohostRequestIds field is historical evidence, not the source of accounting, and cannot be cleared. Old payloads may omit publicationStatus and completion on creation; missing status remains Draft. Existing Published events remain readable. Legacy new publication remains blocked until verified migration. There is no safe client-only proof that all historical requests were enumerated.

Compatibility is limited to known payloads exercising existing secure owner/profile/title-reservation requirements. It cannot preserve insecure unrestricted discovery or publication, nor make an old callable succeed when no function exists. Inventory the actual hosted client before release. Old clients cannot write unaccounted requests on migrated events; they must refresh to the compatibility release. These writes fail safely rather than bypass accounting. Existing reads and stored requests remain available.

Live-client audit correction: the observed Hosting bundle index-sYqHDrJc.js still uses an unfiltered events listener, hostId-only title queries, nonzero co-host counts and no accounting/publication status workflow. The Rules-first order below is NOT authorized for that bundle. Narrow Rules exceptions cannot make its unrestricted student query safe. Use an explicitly coordinated maintenance cutover or first design and verify a bridge release against the actual active Rules. Hosting and Rules deployment are not atomic; old tabs must refresh. See spark-rules-compatibility-audit.md for the tested alternatives. Do not deploy these Rules over that live bundle as an isolated change.

Coordinated release sequence (manual, not performed):

1. Inventory the actual deployed client, active rules, and event/request shapes. Exercise its event creation, direct/registry request submission, approval, editing and discovery against these Rules in an emulator. Do not assume local main or a named Test 1 fixture matches production.
2. Deploy the additive compatibility Rules after that validation. These preserve known legacy writes while supporting version 2 and migration freezes. Do not deploy an earlier two-slot rules file.
3. Build/release this compatibility client with the gate off, let users refresh, and verify organization bootstrap and request visibility. Existing Cloud Function publication was unavailable; legacy publication continues to require migration.
4. Audit and rehearse migration against an isolated emulator/export. Schedule the brief per-event write freeze and require active users of that event to use the compatibility client.
5. Explicitly freeze, review a new dry-run report, and apply the exact reviewed plan for each legacy event. No scripts run automatically. Existing open events with pending requests stay open and their pending counts are initialized accurately.
6. Build/release with VITE_PUBLICATION_V2_ENABLED=true after the new rules are active. New events then start with verified accounting. Keep the legacy compatibility branch for unmigrated records; no immediate global cutover is necessary.

Full production release remains NO-GO until the hosted-client inventory and real legacy data audit are complete. Local emulator success is readiness evidence, not a claim about production data.

## Migration tool: read-only by default

Tool: scripts/migrate-publication.mjs. It dynamically loads firebase-admin from the retained functions development dependencies; this is an operator tool, not a deployed Function. Use authorized local credentials only for explicitly requested connected operations. Do not add credentials to the repository. Node 20+ is recommended. Reports include private request IDs and statuses and must stay local.

Default connected dry-run performs reads only and creates a local report:

```
node scripts/migrate-publication.mjs --project cohost-8fdc0 --event ACTUAL_EVENT_ID --report migration-report.json
```

An offline fixture may be audited without credentials or network:

```
node scripts/migrate-publication.mjs --fixture exported-event-inventory.json --report migration-report.json
```

Fixture structure: eventId, event (raw event fields), requests (all cohostRequests whose eventId matches, each with its original document id), profiles (map keyed by profile document ID), reservation (existing title reservation data or null). An offline fixture cannot prove completeness by itself; apply always queries the live inventory again under a freeze.

Audit checks every request's event/host/requester linkage, status and profile identity/name, including declined history; it accounts for every pending request and verifies historical registry IDs were not omitted. It deduplicates verified accepted organizations for public attribution while retaining all request IDs and histories in the report. More than eight accepted organizations, ambiguous data, conflicting public attribution, missing/renamed profiles or reservation collisions block apply. Do not delete requests or edit accepted flags to force a successful report. Ready/Published legacy records with pending requests or missing explicit completion stop for human review.

After separately obtaining authorization to modify production, verify that freeze-enforcing Rules are active and freeze one event (this IS a production write; never run as a routine validation command):

```
node scripts/migrate-publication.mjs --project cohost-8fdc0 --event ACTUAL_EVENT_ID --freeze --confirm-project cohost-8fdc0 --ack-lock-rules --report frozen-report.json
```

Read and review the resulting full inventory report. Apply requires its exact fingerprint and a separate explicit command:

```
node scripts/migrate-publication.mjs --project cohost-8fdc0 --event ACTUAL_EVENT_ID --apply --expected-plan REVIEWED_FINGERPRINT --confirm-project cohost-8fdc0 --ack-lock-rules --report applied-report.json
```

Apply uses an Admin transaction to reread the freeze, event, every matching request, profiles and title reservation. A changed fingerprint or audit error causes no migration writes. It creates accounting, updates the existing event in place, repairs a missing reservation only when its key is free, and releases the lock on success. Original request documents and negotiations are never updated or deleted. Existing controls cause a stop for manual review. A failed apply leaves the freeze in place; inspect the failure and either rerun/review or separately authorize an Admin lock removal. Freeze and apply are distinct operations. The --ack-lock-rules flag is an operator assertion, not automatic proof that the correct rules were deployed.

For Test 1, inspect the real event ID and Tennis Club request. If verified, the migration retains that request, initializes Tennis Club in confirmedCoHosts, and allows ordinary collaboration completion/manual publication afterward. No actual production Test 1 data has been read or migrated here; the automated rehearsal uses synthetic Test 1/Tennis Club data.

## Validation

Use Java 21 for Firebase CLI. Run:

```
npm run build
npm run lint
npx vitest run --exclude src/services/firestoreRules.emulator.test.ts
npm run test:migration
npm run test:rules
npm --prefix functions test
```

Rules integration runs against demo-cohost only. The command includes a sequential Node/Admin migration rehearsal followed by real owner-authorized Firestore transitions and student visibility checks. Tests must execute rather than skip. The migration Node tests are named nodecheck/emulatorcheck so Vitest does not misinterpret node:test suites.

Remaining limits: shared-control contention can reject concurrent operations; retry from fresh data without blind duplicate submissions. Emulator concurrency tests settle all competing operations and retry rejected attempts, then verify exact counts. Spark quotas and abuse controls still constrain throughput. Profile rename/deletion after submission can block acceptance; already accepted attribution is an immutable acceptance-time snapshot. Active students can own organization profiles too; profile type is not an externally verified role. Accepted-partner withdrawal is not implemented. Backend Admin credentials bypass Rules and require an explicitly authorized operator.

## Deployment commands (reference only)

After release gates above are satisfied:

```
firebase deploy --only firestore:rules --project cohost-8fdc0
```

Build the compatibility release with the gate unset/false. To opt into version-2 creation in PowerShell after Rules activation:

```
$env:VITE_PUBLICATION_V2_ENABLED='true'
npm run build
```

Frontend hosting release, when separately authorized:

```
firebase deploy --only hosting --project cohost-8fdc0
```

Never use an unrestricted firebase deploy: historical functions configuration is retained. No deployment, migration, commit, push, billing change or production read/write is performed by the application tests.
