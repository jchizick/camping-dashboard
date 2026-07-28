import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isDevelopmentLoginAvailable } from '@/lib/devLogin';
import DevLoginForm from './DevLoginForm';

export default function DevLoginPage() {
  if (!isDevelopmentLoginAvailable()) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <DevLoginForm />
    </Suspense>
  );
}
