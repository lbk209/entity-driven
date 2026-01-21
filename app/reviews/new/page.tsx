import ReviewForm from '../ReviewForm';
import BackButton from '../BackButton';

export default function NewReviewPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Write a review</h1>
          <small>User ID and password are required. New users are created automatically.</small>
        </div>
        <div className="button-row page-header__actions">
          <BackButton className="button-link button-link--ghost" />
        </div>
      </div>

      <ReviewForm mode="create" />
    </>
  );
}
