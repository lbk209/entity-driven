import { Suspense } from 'react';
import EntityReviewsClient from './EntityReviewsClient';

export default function EntityReviewsPage() {
  return (
    <Suspense fallback={null}>
      <EntityReviewsClient />
    </Suspense>
  );
}
