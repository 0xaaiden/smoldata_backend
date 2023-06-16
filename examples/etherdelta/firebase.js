// firebase.js
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import serviceAccount from './indexsc-80164-firebase-adminsdk-316pn-04b930921d.json' assert { type: "json" };
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from "firebase-admin/firestore";
const app = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: "https://indexsc-80164-default-rtdb.firebaseio.com",
    storageBucket: "indexsc-80164.appspot.com"
});
const db = getDatabase(app);
const storage = getStorage(app);
const bucket = storage.bucket();
const firestore = getFirestore(app);


export default db;
export { bucket, firestore };