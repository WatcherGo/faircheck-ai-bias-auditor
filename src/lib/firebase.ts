import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: The app will break without specifying the databaseId if it was provided
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
