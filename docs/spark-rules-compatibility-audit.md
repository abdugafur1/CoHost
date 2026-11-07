> Historical rollout record: the production test data has since been reset. Use [spark-clean-launch.md](spark-clean-launch.md) for the current clean V2 launch. Do not run historical migration commands for this launch.

# Can Rules alone fix the deployed client?

Decision: NO. The observed live bundle is /assets/index-sYqHDrJc.js. It was rechecked read-only and still has no eventCollaboration, collaborationVersion, publicationStatus or organizationAccounts. It uses an unfiltered events subscription, hostId-only duplicate-title queries, and nonzero organization attendeeCount values. No production Firestore data or active Rules were inspected. Hosting release d0c456 remains a user-supplied identifier; this audit identifies the actual public asset rather than proving a release-to-source mapping.

## Emulator experiment

src/services/firestoreCompatibility.emulator.test.ts compares the current Rules with an in-memory candidate. The candidate is intentionally NOT installed in firestore.rules and cannot be deployed by the Firebase configuration. No production Rules changes are recommended merely to keep this old bundle alive.

Three narrow candidate exceptions:

1. Permit an event read/query by hostId when the authenticated user owns the corresponding organization profile, whose document ID/type are verified. This allows the old title query without an organizationAccounts marker. It does not authorize unrestricted event listing, another organization's private events, or student-profile ownership as organization access. It relies on the existing invariant that event host identity and profile ownership are verified at creation and immutable to clients.
2. Permit authenticated get of a nonexistent title reservation. There is no reservation data to disclose; existing foreign reservations stay protected. This repairs the old preflight transaction read when an account marker is missing. Existing reservation existence may still be inferred from denial versus not-found, but its contents are not disclosed.
3. On unmigrated events only, permit a nonnegative integer historical co-host attendeeCount as metadata. The event attendee count stays unchanged through submission and approval. Version 2 still requires zero and mandatory atomic accounting. Existing resource matching and owner/profile checks remain intact.

These exceptions can repair creation/editing preflight and some legacy co-host submissions. They do not repair the unfiltered discovery query, migrate data, create account markers, transform request payloads, add resource negotiations, manufacture verified attribution, or provide a missing publication UI. Candidate tests retain the same failures for unsafe operations rather than weakening them.

## Failure classification

- Unfiltered events subscription: frontend change required. Authorizing all documents for students would disclose unpublished events. Rules are authorization predicates, not response filters.
- hostId-only title lookup: narrow Rules fix possible as tested, but replacing it with hostOwnerId == authenticated UID is smaller when shipping the already-fixed client and needs no read exception.
- Missing title reservation lookup without a marker: narrow Rules fix possible as tested. Current frontend bootstrap already solves it with a verified cloud identity and marker.
- Nonzero legacy co-host count: legacy-only metadata exception is possible as tested. Current frontend already uses zero, so production does not need this exception with the replacement client.
- Resource-bearing requests: old client supplies no resourcesProvided/contributionDescription; frontend must supply valid contributions where required. Do not waive matching merely for compatibility.
- Missing status: Rules safely permit legacy creation as Draft, but cannot rewrite it or make the old success message truthful. Legacy events need a verified migration and owner workflow; never blanket-mark them Published.
- Missing accounting writes: frontend transactions required. Rules cannot create the associated control changes or snapshot append. Both candidate and current Rules reject unaccounted version-2 writes.
- Old request approval: may work on eligible unmigrated Pending Collaboration events; migrated events require the new atomic protocol. Forged attribution remains rejected.
- Hosted By: the old client reads only hostName; frontend must render confirmedCoHosts for students.
- Legacy deletion: remains denied to retain history; use the current cancellation UI rather than relaxing retention.

## Smallest recommended implementation/release delta

Keep the approved version-2 architecture and current production Rules source. Do not add the candidate exceptions just to partially rescue a client that still cannot discover events or publish securely. Reuse the existing local frontend fixes rather than introduce another architecture:

1. Student discovery uses publicationStatus == published. Organization discovery combines hostOwnerId == UID, published, and pending_collaboration queries; provision the verified organizationAccounts marker first.
2. Title queries use hostOwnerId == UID. Bootstrap reads the cloud profile and writes only its marker.
3. Creation writes valid status/completion fields; version-2 creation atomically initializes control and an empty public snapshot.
4. Submission, acceptance and rejection use the implemented one-request accounting transactions. Co-host attendance is zero, required resource contributions are included, and acceptance appends verified attribution. Completion/publication stay manual and owner-only.
5. Hosted By reads confirmedCoHosts; cancellation preserves historical events.
6. Explicitly migrate legacy events with the existing dry-run/freeze/fingerprint tool. Rehearse Test 1/Tennis Club against an export or synthetic fixture and audit the real data before any production apply.

These service/UI changes already exist locally; the required additional frontend deliverable is a compatible build and coordinated release, not another redesign. VITE_PUBLICATION_V2_ENABLED=false only keeps new creation in legacy mode; it does not make this client interchangeable with the old hosted client and does not disable accounting on migrated events. Enable the exact value true in the final new-event build once version-2 Rules are active, or newly created events will still require migration before publication.

Before release, inspect the actual active Rules and validate the replacement against them. The latest client always bootstraps organizationAccounts; if active Rules have no such match, Hosting-first also fails. Do not assume reversing deployment order solves the transition. Use a separately tested bridge or a short announced maintenance cutover, with prepared artifacts, staged checks, refresh instructions and a rollback plan. Never loosen student event visibility to accommodate stale tabs. Hosting/Rules deployments are not atomic. Previously fetched data cannot be retroactively removed from already-open old tabs by Security Rules.

## Validation and decision

Run npm run test:rules with Java 21. It sequentially runs the main Rules suite, the compatibility experiment, and the migration rehearsal to avoid cross-suite emulator interference. The compatibility experiment contains 22 cases across the current and candidate Rules: owner queries, unauthorized/student reads, old creation/editing, reservation checks, historical counts, accounting rejection, legacy approval, forged attribution, publication/deletion refusal, unchanged resource matching and a complete verified version-2 publication flow.

NO-GO for a Rules-only deployment over the old frontend. No blocker found here calls for another major architecture change. The remaining release requirements are a coordinated frontend/Rules cutover, real legacy inventory and authorized migration, and stale-client handling. No deployment, production migration, commit or push was performed during this investigation.
