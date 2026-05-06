import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDt_LwDnifk1ndn5JCfN43lv0dKkebu_qY",
  authDomain: "my-schedule-9af83.firebaseapp.com",
  projectId: "my-schedule-9af83",
  storageBucket: "my-schedule-9af83.firebasestorage.app",
  messagingSenderId: "715811565970",
  appId: "1:715811565970:web:c95eaa4cae60b19d2f514b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveData(key, data) {
  await setDoc(doc(db, "schedule", key), { value: JSON.stringify(data) });
}

export function subscribeData(key, callback) {
  return onSnapshot(doc(db, "schedule", key), snap => {
    if (snap.exists()) {
      try { callback(JSON.parse(snap.data().value)); } catch { callback(null); }
    } else {
      callback(null);
    }
  });
}
