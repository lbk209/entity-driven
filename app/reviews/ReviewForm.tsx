'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Entity = {
  id: number;
  name: string;
  type: string;
};

type ReviewFormData = {
  content: string;
  entity_name: string;
  node_id?: number | null;
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
  const [entities, setEntities] = useState<Entity[]>([]);
  const [reviewContent, setReviewContent] = useState(initialData?.content ?? '');
  const [entityName, setEntityName] = useState(initialData?.entity_name ?? '');
  const [entityNodeId, setEntityNodeId] = useState<number | null>(
    initialData?.node_id ?? null
  );
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const suggestionEntities = useMemo(() => {
    const value = entityName.trim().toLowerCase();
    if (!value) return [];
    return entities
      .filter((entity) => entity.name.toLowerCase().includes(value))
      .slice(0, 20);
  }, [entityName, entities]);

  useEffect(() => {
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => setEntities(data.entities || []))
      .catch(() => setEntities([]));
  }, []);

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
      router.push(returnQuery ? `/entity-reviews${returnQuery}` : '/entity-reviews');
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
      node_id: entityNodeId
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
        router.push(`/reviews/${targetId}${returnQuery}`);
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
          <label htmlFor="entity-input">Entity</label>
          <div className="entity-input-wrap">
            <input
              id="entity-input"
              value={entityName}
              onChange={(event) => {
                setEntityName(event.target.value);
                setEntityNodeId(null);
                setShowEntitySuggestions(true);
              }}
              onFocus={() => setShowEntitySuggestions(true)}
              onBlur={() => setShowEntitySuggestions(false)}
              placeholder="Type an entity name"
              className="entity-input"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showEntitySuggestions && suggestionEntities.length > 0}
              aria-controls="entity-suggestion-list"
              required
            />
            {showEntitySuggestions && suggestionEntities.length > 0 && (
              <div className="entity-suggestions" role="listbox" id="entity-suggestion-list">
                {suggestionEntities.map((entity) => (
                  <button
                    type="button"
                    key={entity.id}
                    role="option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setEntityName(entity.name);
                      setEntityNodeId(entity.id);
                      setShowEntitySuggestions(false);
                    }}
                  >
                    {entity.name} ({entity.type})
                  </button>
                ))}
              </div>
            )}
          </div>
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
