'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Entity = {
  id: number;
  name: string;
  type: string;
};

type ReviewFormData = {
  user_id: string;
  content: string;
  entities: string[];
};

type ReviewFormProps = {
  mode: 'create' | 'edit';
  reviewId?: number;
  initialData?: ReviewFormData;
};

export default function ReviewForm({ mode, reviewId, initialData }: ReviewFormProps) {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [reviewUserId, setReviewUserId] = useState(initialData?.user_id ?? '');
  const [reviewPassword, setReviewPassword] = useState('');
  const [reviewContent, setReviewContent] = useState(initialData?.content ?? '');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(
    initialData?.entities ?? []
  );
  const [entityInput, setEntityInput] = useState('');
  const [showAllEntities, setShowAllEntities] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const entityNames = useMemo(
    () => entities.map((entity) => entity.name),
    [entities]
  );

  useEffect(() => {
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => setEntities(data.entities || []))
      .catch(() => setEntities([]));
  }, []);

  function addEntitiesFromInput(value: string) {
    const names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) return;

    setSelectedEntities((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        next.add(name);
      }
      return Array.from(next);
    });
  }

  function handleAddEntity() {
    addEntitiesFromInput(entityInput);
    setEntityInput('');
  }

  function handleEntityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddEntity();
    }
  }

  function removeEntity(name: string) {
    setSelectedEntities((prev) => prev.filter((item) => item !== name));
  }

  async function handleDeleteReview() {
    setSubmitMsg('');
    if (mode !== 'edit' || !reviewId) {
      setSubmitMsg('Missing review id.');
      return;
    }
    if (!window.confirm('Delete this review?')) return;
    const res = await fetch(`/api/review?id=${reviewId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: reviewUserId,
        password: reviewPassword
      })
    });
    if (res.ok) {
      router.push('/');
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
      user_id: reviewUserId,
      password: reviewPassword,
      content: reviewContent,
      entities: selectedEntities.map((name) => ({ name }))
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
        router.push(`/reviews/${targetId}`);
        return;
      }
      setSubmitMsg(isEdit ? 'Review updated.' : 'Review saved.');
      return;
    }

    const data = await res.json().catch(() => ({}));
    setSubmitMsg(data.error || `Failed to ${isEdit ? 'update' : 'save'} review.`);
  }

  const shouldCollapse = selectedEntities.length > 6;
  const showToggle = shouldCollapse;

  return (
    <section className="section">
      <form onSubmit={handleSubmitReview}>
        <div>
          <label htmlFor="entity-input">Entities</label>
          <div
            className={`chip-row chip-row--input ${!showAllEntities && shouldCollapse ? 'chip-row--collapsed' : ''}`}
          >
            {selectedEntities.map((name) => (
              <span className="chip badge" key={name}>
                {name}
                <button type="button" onClick={() => removeEntity(name)} aria-label={`Remove ${name}`}>
                  x
                </button>
              </span>
            ))}
            <div className="entity-input-wrap">
              <input
                id="entity-input"
                value={entityInput}
                onChange={(event) => setEntityInput(event.target.value)}
                onKeyDown={handleEntityKeyDown}
                onBlur={handleAddEntity}
                placeholder="Type an entity name"
                className="entity-input"
                autoComplete="off"
              />
              {entityInput.trim() && (
                <div className="entity-suggestions">
                  {entityNames
                    .filter((name) => name.toLowerCase().includes(entityInput.toLowerCase()))
                    .filter((name) => !selectedEntities.includes(name))
                    .slice(0, 20)
                    .map((name) => (
                      <button
                        type="button"
                        key={name}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          addEntitiesFromInput(name);
                          setEntityInput('');
                        }}
                      >
                        {name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
          {showToggle && (
            <button
              type="button"
              className="link-button"
              onClick={() => setShowAllEntities((prev) => !prev)}
            >
              {showAllEntities ? 'Collapse entities' : 'Show all entities'}
            </button>
          )}
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
            <label htmlFor="review-user-id">User ID</label>
            <input
              id="review-user-id"
              value={reviewUserId}
              onChange={(event) => setReviewUserId(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="review-password">Password</label>
            <input
              id="review-password"
              type="password"
              value={reviewPassword}
              onChange={(event) => setReviewPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit">{mode === 'edit' ? 'Update' : 'Save review'}</button>
          </div>
          {mode === 'edit' && (
            <div>
              <label>&nbsp;</label>
              <button type="button" className="button-link button-link--ghost" onClick={handleDeleteReview}>
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
