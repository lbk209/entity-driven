'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewEntityInput from '../components/ReviewEntityInput';

type ReviewFormData = {
  content: string;
  entity_name: string;
  entity_id?: number | null;
};

type ReviewFormProps = {
  mode: 'create' | 'edit';
  reviewId?: number;
  initialData?: ReviewFormData;
  returnQuery?: string;
};

export default function ReviewForm({
  mode,
  reviewId,
  initialData,
  returnQuery = ''
}: ReviewFormProps) {
  const router = useRouter();
  const [reviewContent, setReviewContent] = useState(initialData?.content ?? '');
  const [entityName, setEntityName] = useState(initialData?.entity_name ?? '');
  const [entityId, setEntityId] = useState<number | null>(
    initialData?.entity_id ?? null
  );
  const [submitMsg, setSubmitMsg] = useState('');

  const buildEntityReviewsHref = (targetReviewId?: number) => {
    const params = new URLSearchParams(returnQuery.replace(/^\?/, ''));
    if (entityId !== null) {
      params.set('entity_id', String(entityId));
    }
    if (targetReviewId) {
      params.set('review', String(targetReviewId));
    } else {
      params.delete('review');
    }
    const serialized = params.toString();
    return serialized ? `/entity-reviews?${serialized}` : '/entity-reviews';
  };

  async function handleDeleteReview() {
    setSubmitMsg('');
    if (mode !== 'edit' || !reviewId) {
      setSubmitMsg('Missing review id.');
      return;
    }
    if (!window.confirm('Delete this review?')) return;
    const res = await fetch(`/api/review?id=${reviewId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      router.push(buildEntityReviewsHref());
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSubmitMsg(data.error || 'Failed to delete review.');
  }

  async function handleSubmitReview(event: React.FormEvent) {
    event.preventDefault();
    setSubmitMsg('');

    if (mode === 'edit' && !reviewId) {
      setSubmitMsg('Missing review id.');
      return;
    }

    const payload = {
      content: reviewContent,
      entity_name: entityName,
      entity_id: entityId
    };

    const isEdit = mode === 'edit';
    const url = isEdit ? `/api/review?id=${reviewId}` : '/api/review';
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const targetId = isEdit ? reviewId : data?.id;
      if (targetId) {
        router.push(buildEntityReviewsHref(targetId));
        router.refresh();
        return;
      }
      setSubmitMsg(isEdit ? 'Review updated.' : 'Review saved.');
      return;
    }

    const data = await res.json().catch(() => ({}));
    setSubmitMsg(data.error || `Failed to ${isEdit ? 'update' : 'save'} review.`);
  }

  return (
    <section className="section">
      <form onSubmit={handleSubmitReview}>
        <div>
          <ReviewEntityInput
            id="entity-input"
            value={entityName}
            entityId={entityId}
            onChange={({ entity_name, entity_id }) => {
              setEntityName(entity_name);
              setEntityId(entity_id);
            }}
            required
            ariaLabel="Entity name"
          />
        </div>

        <div>
          <label htmlFor="review-content">Review text</label>
          <textarea
            id="review-content"
            value={reviewContent}
            onChange={(event) => setReviewContent(event.target.value)}
            required
          />
        </div>

        <div className={`row review-footer ${mode === 'edit' ? 'review-footer--edit' : ''}`}>
          <div>
            <label>&nbsp;</label>
            <button type="submit">{mode === 'edit' ? 'Update' : 'Save review'}</button>
          </div>
          {mode === 'edit' && (
            <div>
              <label>&nbsp;</label>
              <button
                type="button"
                className="button-link button-link--ghost"
                onClick={handleDeleteReview}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </form>
      {submitMsg && <small>{submitMsg}</small>}
    </section>
  );
}
