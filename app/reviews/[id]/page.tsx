import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

type ReviewDetail = {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  entities: string[];
};

function getReview(id: number): ReviewDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT r.id, r.user_id, r.content, r.created_at, r.updated_at,
             GROUP_CONCAT(re.alias, ',') AS entities
      FROM review r
      LEFT JOIN review_entity re ON r.id = re.review_id
      WHERE r.id = ?
      GROUP BY r.id
    `
    )
    .get(id) as
    | {
        id: number;
        user_id: number;
        content: string;
        created_at: string;
        updated_at: string | null;
        entities: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    entities: row.entities ? row.entities.split(',') : []
  };
}

export default function ReviewDetailPage({ params }: { params: { id: string } }) {
  const reviewId = Number(params.id);
  if (!Number.isFinite(reviewId)) {
    notFound();
  }

  const review = getReview(reviewId);
  if (!review) {
    notFound();
  }

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
          <Link href={`/reviews/${review.id}/edit`} className="button-link">
            Edit
          </Link>
          <Link href="/" className="button-link button-link--ghost">
            Back to home
          </Link>
        </div>
      </div>

      <section className="section">
        <div className="entity-row">
          {review.entities.map((name) => (
            <span className="badge" key={name}>{name}</span>
          ))}
        </div>
        <div className="review-content">{review.content}</div>
      </section>
    </>
  );
}
