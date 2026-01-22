import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { isAdmin } from '@/lib/authorization';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    redirect('/login?redirect=/admin');
  }
  if (!isAdmin(sessionUser)) {
    redirect('/entity-reviews');
  }
  return <>{children}</>;
}
