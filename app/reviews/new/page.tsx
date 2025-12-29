import Link from 'next/link';
import ReviewForm from '../ReviewForm';

export default function NewReviewPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Write a review</h1>
          <small>User ID and password are required. New users are created automatically.</small>
        </div>
        <Link href="/" className="button-link button-link--ghost">
          Back to home
        </Link>
      </div>

      <ReviewForm mode="create" />
    </>
  );
}
