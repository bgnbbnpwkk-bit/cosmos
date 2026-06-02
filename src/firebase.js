// Firebase – NUR für Authentifizierung (Google-Login).
// Keine Datenhaltung in Firebase; App-Daten bleiben lokal im localStorage.
//
// Hinweis: Der Web-API-Key ist bewusst öffentlich – er identifiziert nur das
// Projekt. Der Zugriff wird über autorisierte Domains + Security Rules geregelt.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBZbh9UjXGbTTPIO_jewU41sTKYe4pHvNY",
  authDomain: "unser-einkaufszettel.firebaseapp.com",
  databaseURL: "https://unser-einkaufszettel-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "unser-einkaufszettel",
  storageBucket: "unser-einkaufszettel.firebasestorage.app",
  messagingSenderId: "1091522338551",
  appId: "1:1091522338551:web:20bbe0ed444691eebcbdf2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Login bleibt nach App-Neustart erhalten (wichtig für die Home-Screen-PWA).
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Nur diese Google-Accounts dürfen COSMOS nutzen.
export const ALLOWED_EMAILS = [
  "marc.saenger1975@gmail.com",
  "melaniechabane1975@gmail.com",
];

export function isAllowed(email) {
  return !!email && ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}
