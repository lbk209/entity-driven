import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import ReviewForm from '../../ReviewForm';

export const runtime = 'nodejs';

type ReviewEditData = {
  id: number;
  user_id: string;
  content: string;
  entities: string[];
};

function getReviewForEdit(id: number): ReviewEditData | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT r.id, r.content, u.user_id,
             GROUP_CONCAT(e.name, ',') AS entities
      FROM review r
      JOIN user u ON u.id = r.user_id
      LEFT JOIN review_entity re ON r.id = re.review_id
      LEFT JOIN nodes e ON e.id = re.entity_id
      WHERE r.id = ?
      GROUP BY r.id
    `
    )
    .get(id) as
    | {
        id: number;
        user_id: string;
        content: string;
        entities: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    entities: row.entities ? row.entities.split(',') : []
  };
}

export default function EditReviewPage({ params }: { params: { id: string } }) {
  const reviewId = Number(params.id);
  if (!Number.isFinite(reviewId)) {
    notFound();
  }

  const review = getReviewForEdit(reviewId);
  if (!review) {
    notFound();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Edit review</h1>
          <small>Update the content or entities, then save.</small>
        </div>
        <Link href={`/reviews/${review.id}`} className="button-link button-link--ghost">
          Back to review
        </Link>
      </div>

      <ReviewForm
        mode="edit"
        reviewId={review.id}
        initialData={{
          user_id: review.user_id,
          content: review.content,
          entities: review.entities
        }}
      />
    </>
  );
}
