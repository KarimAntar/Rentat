// check_chat_messages_sender.js
// Usage: node check_chat_messages_sender.js DRRJLb0qtvW8KpnsqJj1
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
  projectId: 'rentat-app',
});
const db = getFirestore();
db.settings({ host: 'eur3-firestore.googleapis.com', ssl: true });

async function checkMessages(chatId) {
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    console.error('Chat not found:', chatId);
    process.exit(1);
  }
  const chatData = chatSnap.data();
  const participants = chatData.participants || [];
  const msgsSnap = await chatRef.collection('messages').get();
  let allOk = true;
  for (const doc of msgsSnap.docs) {
    const msg = doc.data();
    if (!participants.includes(msg.senderId)) {
      console.log(`Message ${doc.id} has senderId ${msg.senderId} NOT in participants: [${participants.join(', ')}]`);
      allOk = false;
    }
    if (!msg.senderId) {
      console.log(`Message ${doc.id} is missing senderId`);
      allOk = false;
    }
  }
  if (allOk) {
    console.log('All messages have valid senderId matching chat participants.');
  }
}

const chatId = process.argv[2];
if (!chatId) {
  console.error('Usage: node check_chat_messages_sender.js <chatId>');
  process.exit(1);
}
checkMessages(chatId).catch(err => {
  console.error('Error checking messages:', err);
  process.exit(1);
});
