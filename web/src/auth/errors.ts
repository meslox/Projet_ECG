import { FirebaseError } from 'firebase/app'

export function authErrorMessage(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.'
      case 'auth/weak-password':
        return 'Choose a stronger password (at least 8 characters).'
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.'
      case 'auth/network-request-failed':
        return 'Network error. Check your connection (and that the emulators are running).'
      case 'permission-denied':
        return 'The request was blocked by the security rules.'
    }
  }
  return 'Something went wrong. Please try again.'
}
