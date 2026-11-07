const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { HttpsError, onCall } = require('firebase-functions/v2/https')
const { publishEventForOwner } = require('./publishEvent')

initializeApp()

exports.publishEvent = onCall(async (call) => {
  return publishEventForOwner(getFirestore(), call.auth?.uid, call.data?.eventId)
})
