import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { canEditReview } from '@/lib/authorization';
import ReviewForm from '../../ReviewForm';

export const runtime = 'nodejs';

type ReviewEditData = {
  id: number;
  user_id: number;
  content: string;
  entity_name: string;
  entity_id: number | null;
};

function getReviewForEdit(id: number): ReviewEditData | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT r.id, r.content, r.user_id,
             r.entity_name,
             r.entity_id,
             r.node_id
      FROM review r
      WHERE r.id = ?
    `
    )
    .get(id) as
    | {
        id: number;
        user_id: number;
        content: string;
        entity_name: string;
        entity_id: number | null;
        node_id: number | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    entity_name: row.entity_name,
    entity_id: row.entity_id ?? row.node_id
  };
}

export default function EditReviewPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const reviewId = Number(params.id);
  if (!Number.isFinite(reviewId)) {
    notFound();
  }
  const detailParams = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => detailParams.append(key, entry));
        return;
      }
      if (value !== undefined) {
        detailParams.set(key, value);
      }
    });
  }
  const detailQueryString = detailParams.toString();
  const detailSuffix = detailQueryString ? `?${detailQueryString}` : '';

  const review = getReviewForEdit(reviewId);
  if (!review) {
    notFound();
  }
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    redirect(`/login?redirect=${encodeURIComponent(`/reviews/${reviewId}/edit${detailSuffix}`)}`);
  }
  if (!canEditReview(sessionUser, review.user_id)) {
    redirect(`/reviews/${reviewId}${detailSuffix}`);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Edit review</h1>
          <small>Update the content or entities, then save.</small>
        </div>
        <Link href={`/reviews/${review.id}${detailSuffix}`} className="button-link button-link--ghost">
          Back to review
        </Link>
      </div>

      <ReviewForm
        mode="edit"
        reviewId={review.id}
        initialData={{
          content: review.content,
          entity_name: review.entity_name,
          entity_id: review.entity_id
        }}
        returnQuery={detailSuffix}
      />
    </>
  );
}
