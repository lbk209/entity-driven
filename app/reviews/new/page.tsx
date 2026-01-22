import { redirect } from 'next/navigation';
import ReviewForm from '../ReviewForm';
import BackButton from '../BackButton';
import { getSessionUser } from '@/lib/auth';

export default function NewReviewPage() {
  const sessionUser = getSessionUser();
  if (!sessionUser) {
    redirect('/login?redirect=/reviews/new');
  }
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Write a review</h1>
          <small>You must be logged in to submit a review.</small>
        </div>
        <div className="button-row page-header__actions">
          <BackButton className="button-link button-link--ghost" />
        </div>
      </div>

      <ReviewForm mode="create" />
    </>
  );
}
