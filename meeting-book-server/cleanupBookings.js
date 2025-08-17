// cleanupBookings.js
/**
 * Cleans up expired *pending* bookings by HARD-DELETING them
 * from both floor collections.
 *
 * - Targets: bookings_floor10, bookings_floor7
 * - Criteria: status == "pending" AND end <= now (ISO)
 * - Runs every 1 hour (and once immediately on start)
 *
 * NOTE on credentials:
 * - Preferred: set GOOGLE_APPLICATION_CREDENTIALS in the environment.
 * - Fallback: local serviceAccountKey.json in the same folder.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  // Prefer application default via GOOGLE_APPLICATION_CREDENTIALS
  const hasAppDefault =
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (hasAppDefault) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('[Cleanup] Initialized Firebase Admin using GOOGLE_APPLICATION_CREDENTIALS');
    return;
  }

  // Fallback to local file
  const fallbackPath = path.join(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(fallbackPath)) {
    throw new Error(
      '[Cleanup] No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json next to this file.'
    );
  }

  const serviceAccount = require(fallbackPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('[Cleanup] Initialized Firebase Admin using serviceAccountKey.json');
}

initFirebaseAdmin();

const db = admin.firestore();

// Collections we care about
const BOOKING_COLLECTIONS = ['bookings_floor10', 'bookings_floor7'];

// Firestore batch limit
const BATCH_LIMIT = 450;

/**
 * Delete docs in chunks to respect Firestore batch limits
 */
async function deleteDocsInChunks(docRefs) {
  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += BATCH_LIMIT) {
    const chunk = docRefs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function cleanupExpiredBookingsOnce() {
  const now = new Date();
  const nowISO = now.toISOString();
  console.log(`[Cleanup] Checking expired pending bookings at ${nowISO}`);

  let totalDeleted = 0;

  for (const colName of BOOKING_COLLECTIONS) {
    try {
      // Since your `end` is stored as ISO string, lexical compare works with ISO
      const q = db.collection(colName).where('status', '==', 'pending');
const snap = await q.get();

      if (snap.empty) {
        console.log(`[Cleanup] ${colName}: none to delete.`);
        continue;
      }

      const toDelete = [];
snap.forEach((docSnap) => {
  const data = docSnap.data() || {};
  const end = data.end;
  if (!end) return;

  const endTime = new Date(end);
  if (!isNaN(endTime.getTime()) && endTime <= now && data.status === 'pending') {
    toDelete.push(docSnap.ref);
  }
});


      if (toDelete.length === 0) {
        console.log(`[Cleanup] ${colName}: query matched, but nothing passed final guards.`);
        continue;
      }

      const deleted = await deleteDocsInChunks(toDelete);
      totalDeleted += deleted;
      console.log(`[Cleanup] ${colName}: deleted ${deleted} expired pending bookings.`);
    } catch (err) {
      console.error(`[Cleanup] ${colName}: error during cleanup:`, err.message);
    }
  }

  if (totalDeleted === 0) {
    console.log('[Cleanup] No expired pending bookings found in any collection.');
  } else {
    console.log(`[Cleanup] Total deleted across collections: ${totalDeleted}`);
  }
}

function startScheduler() {
  // Run immediately on start
  cleanupExpiredBookingsOnce().catch((e) =>
    console.error('[Cleanup] Initial run failed:', e.message)
  );

  // Run every 1 hour
  const ONE_HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    cleanupExpiredBookingsOnce().catch((e) =>
      console.error('[Cleanup] Scheduled run failed:', e.message)
    );
  }, ONE_HOUR_MS);
}

startScheduler();
