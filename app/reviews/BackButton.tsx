'use client';

import { useRouter } from 'next/navigation';

type BackButtonProps = {
  className?: string;
};

export default function BackButton({ className = '' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/');
      }}
    >
      Back
    </button>
  );
}
