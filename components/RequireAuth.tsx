'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { STORAGE_KEYS } from '@/lib/config';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // also check our local flag if you want a fast gate
      const loggedInFlag = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === 'true';
      if (user && loggedInFlag) {
        setReady(true);
      } else {
        router.replace('/login');
      }
    });
    return () => unsub();
  }, [router]);

  if (!ready) return null; // or a spinner
  return <>{children}</>;
}
