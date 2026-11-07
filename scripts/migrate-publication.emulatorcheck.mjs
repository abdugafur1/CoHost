import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, updateDoc, setDoc, query, collection, getDocs, where } from 'firebase/firestore'
import { applyMigration, loadInventory, planMigration } from './migrate-publication.mjs'

// Independent fixture: does not import the unit-test module or run against production.
test('frozen Test 1 migration preserves original request and unlocks verified publication', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST, /^(127\.0\.0\.1|localhost):\d+$/)
  const require = createRequire(new URL('../functions/package.json', import.meta.url))
  const { initializeApp, deleteApp } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  const app = initializeApp({ projectId: 'demo-cohost' }, 'migration-test'), admin = getFirestore(app)
  const env = await initializeTestEnvironment({ projectId: 'demo-cohost', firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } })
  try {
    const event = { title: 'Test 1', hostId: 'esport', hostOwnerId: 'esport-owner', hostProfileType: 'organization',
      attendees: 0, capacity: 30, createdAt: '2026-11-01', audience: 'everyone', dateOptions: ['2026-12-01'] }
    const request = { eventId: 'test-1', requestType: 'cohost', hostOwnerId: 'esport-owner', hostProfileId: 'esport',
      requesterOwnerId: 'tennis-owner', requesterProfileId: 'tennis', requesterProfileType: 'organization',
      requesterName: 'Tennis Club', status: 'accepted', message: 'Retain this negotiation', createdAt: '2026-11-01' }
    await admin.doc('events/test-1').set(event)
    await admin.doc('cohostRequests/original-tennis-request').set(request)
    for (const [id, ownerId, name] of [['esport', 'esport-owner', 'Esport Club'], ['tennis', 'tennis-owner', 'Tennis Club']]) {
      await admin.doc(`userProfiles/${id}`).set({ id, ownerId, name, profileType: 'organization' })
    }
    const before = planMigration(await loadInventory(admin, 'test-1'))
    assert.equal(before.ready, true)
    assert.equal((await admin.doc('events/test-1').get()).data().collaborationVersion, undefined)
    await assert.rejects(applyMigration(admin, 'test-1', before.fingerprint), /freeze/)
    await admin.doc('eventMigrationLocks/test-1').create({ protocol: 'publication-v2' })
    await assert.rejects(applyMigration(admin, 'test-1', 'wrong-hash'), /changed/)
    assert.equal((await admin.doc('eventCollaboration/test-1').get()).exists, false)
    await applyMigration(admin, 'test-1', before.fingerprint)
    assert.deepEqual((await admin.doc('cohostRequests/original-tennis-request').get()).data(), request)
    assert.equal((await admin.doc('eventMigrationLocks/test-1').get()).exists, false)
    await assert.rejects(applyMigration(admin, 'test-1', before.fingerprint), /freeze/)
    const host = env.authenticatedContext('esport-owner').firestore()
    const tennis = env.authenticatedContext('tennis-owner').firestore()
    const student = env.authenticatedContext('student-owner').firestore()
    await assertSucceeds(getDoc(doc(host, 'events', 'test-1')))
    await assertSucceeds(getDocs(query(collection(tennis, 'cohostRequests'), where('requesterOwnerId', '==', 'tennis-owner'), where('requesterProfileId', '==', 'tennis'))))
    await assertFails(getDoc(doc(student, 'events', 'test-1')))
    await assertSucceeds(updateDoc(doc(host, 'events', 'test-1'), { publicationStatus: 'pending_collaboration' }))
    await assertSucceeds(updateDoc(doc(host, 'events', 'test-1'), { publicationStatus: 'ready_to_publish', collaborationRequirementsCompleted: true }))
    await assertSucceeds(updateDoc(doc(host, 'events', 'test-1'), { publicationStatus: 'published' }))
    assert.deepEqual((await getDoc(doc(student, 'events', 'test-1'))).data().confirmedCoHosts, [{ profileId: 'tennis', name: 'Tennis Club' }])
    await assertFails(setDoc(doc(host, 'eventCollaboration', 'test-1'), { pendingCount: 0 }))
  } finally { await env.clearFirestore(); await env.cleanup(); await admin.terminate(); await deleteApp(app) }
})
