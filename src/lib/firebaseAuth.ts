import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export async function signInWithGoogle(): Promise<{
  idToken: string;
  accessToken: string | null;
  firebaseUser: FirebaseUser;
}> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken ?? null;
  const idToken = await result.user.getIdToken();

  return {
    idToken,
    accessToken: cachedAccessToken,
    firebaseUser: result.user,
  };
}

export function getCachedGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export async function signOutFirebase(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
