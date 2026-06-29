importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDjKYzt_x4LcdJR2UgOM91_cx3ZTktrShA",
  authDomain: "teak-infusion.firebaseapp.com",
  projectId: "teak-infusion",
  storageBucket: "teak-infusion.firebasestorage.app",
  messagingSenderId: "976405757455",
  appId: "1:976405757455:web:fc17259fbf8c94c8db6d7a",
  measurementId: "G-E077LQN5TV"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
