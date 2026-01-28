import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { canEditReview } from '@/lib/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReviewDetail = {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  entity_name: string;
};

function getReview(id: number): ReviewDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT r.id, r.user_id, r.content, r.created_at, r.updated_at,
             r.entity_name
      FROM review r
      WHERE r.id = ?
    `
    )
    .get(id) as
    | {
        id: number;
        user_id: number;
        content: string;
        created_at: string;
        updated_at: string | null;
        entity_name: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    entity_name: row.entity_name
  };
}

export default function ReviewDetailPage({
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
  const listHref = detailSuffix ? `/entity-reviews${detailSuffix}` : '/entity-reviews';

  const review = getReview(reviewId);
  if (!review) {
    notFound();
  }
  const sessionUser = getSessionUser();
  const canEdit = canEditReview(sessionUser, review.user_id);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Review Detail</h1>
          <small>
            user #{review.user_id} ·{' '}
            {new Date(review.updated_at ?? review.created_at).toLocaleString()}
          </small>
        </div>
        <div className="button-row">
          {canEdit && (
            <Link href={`/reviews/${review.id}/edit${detailSuffix}`} className="button-link">
              Edit
            </Link>
          )}
          <Link href={listHref} className="button-link button-link--ghost">
            Back
          </Link>
        </div>
      </div>

      <section className="section">
        <div className="entity-row">
          <span className="badge">{review.entity_name}</span>
        </div>
        <div className="review-content">{review.content}</div>
      </section>
    </>
  );
}
