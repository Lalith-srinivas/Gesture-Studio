/**
 * Bulk Delete All Anonymous Guest Users
 * - Deletes from Firebase Authentication
 * - Deletes corresponding Firestore documents from 'users' and 'leaderboards'
 *
 * Requirements:
 * 1. Place 'serviceAccountKey.json' in the project root (c:\Air Draw\serviceAccountKey.json)
 *    Download it from: Firebase Console -> Project Settings -> Service accounts -> Generate new private key
 * 2. Run: node scripts/deleteGuestUsers.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error('\n❌ ERROR: "serviceAccountKey.json" not found!');
  console.log('\nTo get this key in 30 seconds:');
  console.log('1. Go to Firebase Console -> ⚙️ Project Settings -> Service accounts tab');
  console.log('2. Click "Generate new private key"');
  console.log(`3. Save the downloaded JSON file as:\n   ${keyPath}\n`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

const app = initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth(app);
const db = getFirestore(app);

async function deleteGuests() {
  console.log('🔍 Scanning Firebase Authentication for anonymous guest users...');
  let nextPageToken;
  const guestUids = [];

  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    for (const user of listResult.users) {
      // Anonymous users have no email and no third-party providers (providerData is empty)
      const isAnonymous = user.providerData.length === 0 && !user.email;
      if (isAnonymous) {
        guestUids.push(user.uid);
      }
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`📊 Found ${guestUids.length} anonymous guest users.`);

  if (guestUids.length === 0) {
    console.log('✨ No anonymous guest users found. Nothing to delete.');
    return;
  }

  // 1. Delete from Firebase Authentication (batches of 1000)
  console.log('\n🚀 Deleting anonymous accounts from Firebase Authentication...');
  for (let i = 0; i < guestUids.length; i += 1000) {
    const batch = guestUids.slice(i, i + 1000);
    const result = await auth.deleteUsers(batch);
    console.log(`   Deleted ${result.successCount} auth accounts.`);
    if (result.failureCount > 0) {
      console.warn(`   Failed to delete ${result.failureCount} auth accounts.`);
    }
  }

  // 2. Clean up Firestore 'users' documents
  console.log('\n🧹 Cleaning up Firestore user records...');
  let firestoreDeleted = 0;
  for (let i = 0; i < guestUids.length; i += 400) {
    const batch = db.batch();
    const slice = guestUids.slice(i, i + 400);
    slice.forEach((uid) => {
      batch.delete(db.collection('users').doc(uid));
      batch.delete(db.collection('leaderboards').doc('global').collection('entries').doc(uid));
    });
    await batch.commit();
    firestoreDeleted += slice.length;
  }
  console.log(`   Cleaned up ${firestoreDeleted} Firestore documents.`);

  console.log('\n✅ SUCCESS: All anonymous guest users have been completely removed!');
}

deleteGuests().catch((err) => {
  console.error('\n❌ Error executing cleanup:', err);
  process.exit(1);
});

