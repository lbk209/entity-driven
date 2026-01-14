import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import ReviewForm from '../../ReviewForm';

export const runtime = 'nodejs';

type ReviewEditData = {
  id: number;
  user_id: string;
  content: string;
  entity_name: string;
  node_id: number | null;
};

function getReviewForEdit(id: number): ReviewEditData | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT r.id, r.content, u.user_id,
             r.entity_name,
             r.node_id
      FROM review r
      JOIN user u ON u.id = r.user_id
      WHERE r.id = ?
    `
    )
    .get(id) as
    | {
        id: number;
        user_id: string;
        content: string;
        entity_name: string;
        node_id: number | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    content: row.content,
    entity_name: row.entity_name,
    node_id: row.node_id
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
          entity_name: review.entity_name,
          node_id: review.node_id
        }}
      />
    </>
  );
}
