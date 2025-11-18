// check_eur3_users.js
// Usage: node check_eur3_users.js
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin with eur3 region
initializeApp({
  credential: applicationDefault(),
  projectId: 'rentat-app',
});
const db = getFirestore();
db.settings({ host: 'eur3-firestore.googleapis.com', ssl: true });

const userIds = [
  'UQvIsxhdKlT2lnIZuyDvihMOoX22',
  '5oQsSCbaKiWH3T8hdzVbkZZQhrJ3'
];

Promise.all(userIds.map(id => db.collection('users').doc(id).get()))
  .then(results => {
    results.forEach((doc, idx) => {
      console.log(`User ${idx + 1} (${userIds[idx]}):`, doc.exists ? doc.data() : 'NOT FOUND');
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error fetching user docs:', err);
    process.exit(1);
  });
