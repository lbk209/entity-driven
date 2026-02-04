import { Suspense } from 'react';
import TopEntitiesClient from './TopEntitiesClient';

export default function TopEntitiesPage() {
  return (
    <Suspense fallback={null}>
      <TopEntitiesClient />
    </Suspense>
  );
}
