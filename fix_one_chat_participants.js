// fix_one_chat_participants.js
// Usage: node fix_one_chat_participants.js DRRJLb0qtvW8KpnsqJj1
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

async function fixChat(chatId) {
  const chatRef = db.collection('chats').doc(chatId);
  const docSnap = await chatRef.get();
  if (!docSnap.exists) {
    console.error('Chat not found:', chatId);
    process.exit(1);
  }
  let data = docSnap.data();
  let participants = data.participants || [];
  if (!Array.isArray(participants) || participants.length < 2) {
    if (data.participantsKey && typeof data.participantsKey === 'string') {
      participants = data.participantsKey.split(':');
    }
  }
  participants = [...new Set(participants)].filter(Boolean);
  const participantsKey = buildParticipantsKey(participants);
  await chatRef.update({ participants, participantsKey });
  console.log(`Fixed chat ${chatId}: participants = [${participants.join(', ')}], participantsKey = ${participantsKey}`);
}

const chatId = process.argv[2];
if (!chatId) {
  console.error('Usage: node fix_one_chat_participants.js <chatId>');
  process.exit(1);
}
fixChat(chatId).catch(err => {
  console.error('Error fixing chat:', err);
  process.exit(1);
});
