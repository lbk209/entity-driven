import { Suspense } from 'react';
import NodeReviewStatsClient from './NodeReviewStatsClient';

export default function NodeReviewStatsPage() {
  return (
    <Suspense fallback={null}>
      <NodeReviewStatsClient />
    </Suspense>
  );
}
