// fix_chat_participants.js
// Usage: node fix_chat_participants.js
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
  projectId: 'rentat-app',
});
const db = getFirestore();
db.settings({ host: 'eur3-firestore.googleapis.com', ssl: true });

function buildParticipantsKey(uids) {
  return [...uids].sort().join(':');
}

async function fixChats() {
  const chatsSnap = await db.collection('chats').get();
  let fixed = 0;
  for (const doc of chatsSnap.docs) {
    const data = doc.data();
    let participants = data.participants || [];
    // If participants is not an array or has less than 2, try to reconstruct from participantsKey
    if (!Array.isArray(participants) || participants.length < 2) {
      if (data.participantsKey && typeof data.participantsKey === 'string') {
        participants = data.participantsKey.split(':');
      }
    }
    // Remove duplicates and empty strings
    participants = [...new Set(participants)].filter(Boolean);
    const participantsKey = buildParticipantsKey(participants);
    // Only update if values are wrong
    if (
      JSON.stringify(participants) !== JSON.stringify(data.participants) ||
      participantsKey !== data.participantsKey
    ) {
      await db.collection('chats').doc(doc.id).update({
        participants,
        participantsKey,
      });
      fixed++;
      console.log(`Fixed chat ${doc.id}: participants = [${participants.join(', ')}], participantsKey = ${participantsKey}`);
    }
  }
  console.log(`Done. Fixed ${fixed} chat(s).`);
}

fixChats().catch(err => {
  console.error('Error fixing chats:', err);
  process.exit(1);
});
