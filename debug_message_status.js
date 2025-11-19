const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();

async function debugMessageStatus() {
  try {
    // Get all chats
    const chatsSnapshot = await db.collection('chats').get();
    
    console.log(`\nFound ${chatsSnapshot.size} chats\n`);
    
    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      console.log(`\n=== Chat ID: ${chatDoc.id} ===`);
      console.log(`Participants: ${chatData.participants?.join(', ')}`);
      console.log(`Unread Count:`, chatData.metadata?.unreadCount);
      
      // Get messages for this chat
      const messagesSnapshot = await db
        .collection('chats')
        .doc(chatDoc.id)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();
      
      console.log(`\nLast ${messagesSnapshot.size} messages:`);
      
      messagesSnapshot.forEach((msgDoc, index) => {
        const msgData = msgDoc.data();
        console.log(`\n  Message ${index + 1}:`);
        console.log(`    ID: ${msgDoc.id}`);
        console.log(`    Sender: ${msgData.senderId}`);
        console.log(`    Text: ${msgData.content?.text?.substring(0, 50)}...`);
        console.log(`    Status:`, {
          sent: msgData.status?.sent?.toDate?.(),
          delivered: msgData.status?.delivered?.toDate?.(),
          read: msgData.status?.read?.toDate?.(),
          readBy: msgData.status?.readBy || []
        });
      });
      
      console.log('\n' + '='.repeat(50));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugMessageStatus();
