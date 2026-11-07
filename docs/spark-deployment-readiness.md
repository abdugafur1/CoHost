> Historical rollout record: the production test data has since been reset. Use [spark-clean-launch.md](spark-clean-launch.md) for the current clean V2 launch. Do not run historical migration commands for this launch.

# Final deployment readiness ? CoHost Spark

Decision: CONDITIONAL TECHNICAL GO for the staged plan below; NO-GO for executing it until the unchecked operator gates are satisfied. No deployment, production migration, Firestore mutation, commit, push, or billing change has been performed.

Audit: 2026-11-07 01:37 CST (07:37 UTC). All production requests used authenticated GET APIs. OAuth token renewal was authentication only. Private evidence and raw exports are under the Git-ignored .firebase/readiness-2026-11-07 directory, outside Hosting public directories. Do not publish that directory or commit its contents.

## Verified production state

- Project: cohost-8fdc0; database: (default).
- Active Rules release: projects/cohost-8fdc0/releases/cloud.firestore.
- Active ruleset: 8bfbd694-ef72-4cca-bf7b-56a8ed736bab, updated 2026-11-07 00:28 CST.
- Active Rules SHA-256: 917ec33c564311aeab76bff6558082f8f4f6bfa6c2ad5df2905cec2a0bfe345d.
- Proposed local Rules SHA-256: f6d109638e735e260be668eb85639ea3aa12c3c06fee7ac29a492de89b85b2dd.
- Verified Hosting version: dc90f13569d0c456 (the supplied d0c456 suffix), released 2026-11-06 14:32 CST.
- Inventory: 1 event, 2 co-host requests, 0 participation requests, 3 profiles, 1 title reservation, 2 valid organization-account markers, 0 accounting documents, 0 migration locks, 0 public directory listings.

Active Rules already enforce explicit Published visibility, organization markers, ownership and title reservations. They prohibit client transition into Published and prohibit confirmedCoHosts changes. They have no version-2 accounting or migration-freeze checks. Proposed Rules add accounting, verified per-acceptance attribution, zero-pending completion/publication, immutable protocol fields, history retention and freeze enforcement. They strengthen organization-marker identity and participation acceptance checks. They preserve the same published-only student event visibility. No experimental compatibility exceptions are included.

The live frontend is already mismatched with these active Rules: it uses unfiltered event reads and hostId-only title queries. Do not roll back to that old bundle as a supposedly working recovery target.

## Real Test 1 migration readiness

Event ID: 66244ea7-c3b6-4e5f-a055-58d6ab47cccf.

- Host: Esport Club.
- Current status: ready_to_publish; collaborationRequirementsCompleted is true.
- One associated co-host request, accepted from Tennis Club.
- No pending associated requests; no public confirmedCoHosts field yet.
- Referenced organization profiles and reservation match; no existing control blocks initialization.
- Existing migration planner: ready=true, no issues. It proposes acceptedCount=1, pendingCount=0, totalRequests=1, and the verified Tennis Club public attribution.
- Offline dry-run and local emulator migration using the actual exported inventory passed. The original request stays byte-equivalent as decoded data, status stays Ready until manual owner publication, and a student sees Tennis Club only after publication.
- Do not reuse the audit-time fingerprint at apply. Freeze, rerun the connected report, and approve its current fingerprint.

A second accepted Tennis Club request refers to missing event accee94b-cb38-4122-a37e-76f552cbd08e. Its title is also Test 1, but it is a DIFFERENT event ID. It is retained unchanged in the backup and production. Never merge it into the surviving event by title, fabricate its event, or delete it to obtain a clean report. Release owner must explicitly accept preserving this orphan as historical data and document the unavailable-event behavior. It does not count toward the surviving Test 1 event's partnership accounting.

## Prepared artifacts and Hosting configuration

Root firebase.json serves dist, rewrites all SPA routes to /index.html, and still contains historical Functions configuration. Always target hosting or firestore:rules explicitly. Do not run an unrestricted firebase deploy.

Two immutable local build copies and dedicated Hosting-only configs are prepared:

| Stage | Flag | Entry asset | Hosting config |
| --- | --- | --- | --- |
| Compatibility | false | index-C9JqL6tM.js | .firebase/readiness-2026-11-07/hosting-compatibility.json |
| Version 2 | true | index-C6PYL5Yr.js | .firebase/readiness-2026-11-07/hosting-v2.json |
| Incident/maintenance | N/A | Static maintenance page | .firebase/readiness-2026-11-07/hosting-maintenance.json |

Config parsing and public-path containment were verified locally with the installed Firebase CLI. Each config publishes only its intended frontend directory, not sibling audit exports. artifact-manifest.json records source Rules and build hashes. Current dist contains the true build; do NOT use the root Hosting command for the compatibility-first step by mistake.

VITE_PUBLICATION_V2_ENABLED is compiled by Vite at build time. Exact value true opts new events into version 2. False/unset creates legacy events, but DOES NOT disable accounting for already migrated events. Changing the shell variable after build does not alter an artifact. The two prepared bundles were inspected to confirm their differing creation branches. A true build must not run against old Rules, which reject its initial accounting and public snapshot writes.

The real active Rules were loaded into the emulator with real profile/event data. The replacement flag-off client's cloud bootstrap, owner/pending/published queries and legacy creation payload all passed while student unpublished reads remained denied. This establishes a lower-disruption Hosting-FIRST compatibility step for this verified baseline. It supersedes the earlier generic Rules-first plan; recheck the active Rules hash before using this sequence.

## Release gates ? satisfy before executing deployment commands

- [x] Active Rules and complete known app collections read and saved locally; Hosting version identified independently.
- [x] Real Test 1 dry-run passes; actual-inventory migration/publication rehearsal passes in demo-cohost only.
- [x] Both flag-specific builds succeed and artifacts/config paths are verified.
- [x] Readiness validation passed: 35 main Rules tests, 22 compatibility tests, the synthetic migration rehearsal, the actual-production-inventory rehearsal, 84 frontend/service tests, 8 migration audit/CLI tests, lint, and both build variants. Build emits the existing bundle-size warning.
- [ ] Approve a specific low-traffic 60-minute maintenance window, release owner, observer, affected organization contacts, and abort deadline. This document does not schedule or authorize it.
- [ ] Acknowledge and preserve the orphan accepted request; no automatic historical cleanup.
- [ ] Revoke/re-authenticate the Firebase CLI credential exposed by the initial account-list command's output. No tokens are copied into this document or exported data; future listings must filter token fields before display.
- [ ] Recheck active Rules and Hosting release immediately before release. Stop on drift from the recorded baseline.
- [ ] Copy the private backup and artifact manifest to an access-controlled backup location and validate checksums. The current local REST export is sequential, not a transactionally consistent managed database backup; refresh the target event inventory after its freeze.
- [ ] BLOCKED: configure authorized Admin/Application Default Credentials on the migration operator workstation and pass a connected read-only dry run. The existing script was tried with no mutation flags and failed both inside and outside the sandbox: "Could not load the default credentials." Neither GOOGLE_APPLICATION_CREDENTIALS nor a default ADC file is configured. Firebase CLI OAuth used for the audit is not ADC. No credentials were installed or generated here.
- [ ] Review/approve the fresh freeze report separately before migration. Production migration authorization is NOT granted by authorizing a Hosting/Rules deploy.
- [ ] Decide whether to authorize controlled production smoke-test records/accounts, including a disposable lock-enforcement test. Emulator success does not prove deployed Rules propagation.
- [ ] Close/refresh old tabs on affected accounts and confirm anonymous users keep their existing UID. Never ask users to clear local storage, site data, or sign out as a refresh technique.

No remaining code redesign or new Rules exception is required by this audit. Remaining release blocks are missing migration ADC, operator decisions, credential hygiene, consistent pre-apply inventory, and verified rollout checkpoints above.

## Backup and rollback policy

Private backup files include active-firestore.rules, active Rules/release metadata, Hosting release metadata, all nine known collection exports with document names/update times, Test 1 inventory and plan, and the two build artifacts. Audit exports are not evidence that unknown subcollections were backed up; inventory application-owned collections and preserve any additional collections before a wider restore plan. Keep the original accepted requests immutable.

Safe rollback is maintenance Hosting or the prepared compatibility frontend with the NEW Rules retained. The compatibility frontend still understands migrated records. Do not roll back to dc90f13569d0c456: it cannot operate under the secure event query model. Do not restore pre-accounting Rules after any migration/version-2 write: they would permit unaccounted legacy-style operations. Preserve the old Rules for evidence, not an automatic production rollback.

Do not overwrite Firestore with the old export during rollback. That would discard new activity. If migration data needs correction, stop writes, use an explicitly reviewed Admin incident lock, compare update times, and roll forward from the retained evidence. The existing --freeze CLI intentionally rejects version-2 events; it is not a general incident-lock tool. Any corrective production write requires separate approval. Hosting rollback does not reverse Firestore migration.

## Coordinated window and hold points

T-24h (or agreed notice): notify affected organizations, distribute the maintenance/refresh procedure, identify the exact Test 1 ID, approve the orphan disposition and backup custody.

T+0 to +10: publish the compatibility frontend under current Rules. Open fresh owner/student sessions and verify expected entry asset, marker bootstrap, owner Test 1 visibility, student Published-only query and no new schema-2 creations. Test 1 remains Ready and private. If this checkpoint fails, stop and show maintenance; do not deploy Rules or migrate.

T+10 to +20: enter the announced write pause and show the prepared maintenance page if needed. Deploy new Rules. Check the active release source hash and wait for propagation; allow several minutes rather than assuming immediate activation. Verify privacy and accounting/freeze rejection with fresh clients and an authorized disposable canary. Old tabs must be closed/refreshed; a static maintenance page does not terminate existing sessions. Do not begin Test 1 migration until freeze enforcement is demonstrated.

T+20 to +40: separately authorized operator freezes ONLY Test 1, refreshes its inventory/backup, reviews all requests and fingerprint, and applies the approved migration. Existing script preserves the event and request; no automatic publish. If the inventory changed or any audit issue occurs, keep the event frozen and stop. Resolve through review; never omit history.

T+40 to +50: publish the prepared true frontend. Confirm its asset and new-event protocol. Host manually publishes Test 1 after checking Esport Club + Tennis Club attribution; this is a separately authorized owner action, not part of the migration tool.

T+50 to +60: verify the scenarios below, then end maintenance. If a hold point exceeds the approved window, retain maintenance and announce an extension/abort rather than skip checks. Rules/Hosting deployment is not atomic and existing cached listeners/tabs may persist beyond the window.

## Post-deployment verification

- [ ] Exact Hosting entry asset and Rules hash match the approved manifest; no Functions deploy or billing change occurred.
- [ ] Existing anonymous and linked/Google users retain UID/profile ownership after refresh.
- [ ] Host sees Test 1; Tennis Club sees its original accepted request; the orphan remains preserved and is not attributed to the surviving event.
- [ ] Before explicit publication, student and unauthenticated clients cannot read Test 1; unfiltered event queries remain denied.
- [ ] Migrated control for Test 1 has totalRequests=1, pendingCount=0, acceptedCount=1, Tennis Club's profile ID. Confirmed attribution matches the plan; the original request/message/resources are unchanged.
- [ ] After manual publication, students see Esport Club + Tennis Club and can submit valid participation requests. Private co-host messages/resources remain unreadable.
- [ ] On authorized disposable test records: third/later submissions work, declines preserve history without consuming partner slots, missing accounting and unauthorized approvals fail, zero-pending completion and manual publication work, and no ninth partner is accepted.
- [ ] Existing profile save, cancellation, directory opt-in and participation approval work with intended constraints. An empty public directory is expected: production currently has no public listings; migration must not silently opt private organizations in.
- [ ] No repeated permission-error loops or unresolved contention errors after fresh reload. Keep backups and monitor through the agreed observation period.

## Exact commands ? reference only, AFTER the gates above are approved

Run from C:\Users\24419\Desktop\CoHost. These commands are NOT executed by this checklist. All mutations below require separate explicit authorization.

1. Compatibility Hosting only (flag already baked false):

```powershell
firebase deploy --only hosting --project cohost-8fdc0 --config .firebase/readiness-2026-11-07/hosting-compatibility.json
```

2. Optional maintenance page before Rules/data cutover:

```powershell
firebase deploy --only hosting --project cohost-8fdc0 --config .firebase/readiness-2026-11-07/hosting-maintenance.json
```

3. Proposed production Rules only, after compatibility smoke checks:

```powershell
firebase deploy --only firestore:rules --project cohost-8fdc0
```

4. Only after separate migration authorization and verified freeze Rules propagation, freeze the exact surviving Test 1 event:

```powershell
node scripts/migrate-publication.mjs --project cohost-8fdc0 --event 66244ea7-c3b6-4e5f-a055-58d6ab47cccf --freeze --confirm-project cohost-8fdc0 --ack-lock-rules --report .firebase/readiness-2026-11-07/test-1-frozen-report.json
```

Review the newly generated report, then substitute its approved fingerprint (never the earlier audit hash):

```powershell
node scripts/migrate-publication.mjs --project cohost-8fdc0 --event 66244ea7-c3b6-4e5f-a055-58d6ab47cccf --apply --expected-plan APPROVED_FRESH_FINGERPRINT --confirm-project cohost-8fdc0 --ack-lock-rules --report .firebase/readiness-2026-11-07/test-1-applied-report.json
```

5. Version-2 Hosting only, after Rules and migration hold points:

```powershell
firebase deploy --only hosting --project cohost-8fdc0 --config .firebase/readiness-2026-11-07/hosting-v2.json
```

6. Incident Hosting rollback (retain new Rules and all data): use the maintenance command, or restore the prepared compatibility frontend using command 1. Do not run a broad firebase deploy or deploy Functions. Do not restore the earlier Rules automatically.

If code/config changes after preparation, rebuild and review a new manifest instead of deploying stale artifacts. No private export is inside a Hosting public directory.
