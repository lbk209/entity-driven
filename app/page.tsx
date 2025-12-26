'use client';

import { useEffect, useMemo, useState } from 'react';

type Entity = {
  id: number;
  name: string;
  type: string | null;
  level: number | null;
  parent_id: number | null;
};

type Review = {
  id: number;
  user_id: number;
  created_at: string;
  preview: string;
  entities: string[];
};

export default function HomePage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filterEntity, setFilterEntity] = useState('');

  const [newUserId, setNewUserId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userMsg, setUserMsg] = useState('');

  const [reviewUserId, setReviewUserId] = useState('');
  const [reviewPassword, setReviewPassword] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [newEntityNames, setNewEntityNames] = useState('');
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

  useEffect(() => {
    const trimmed = filterEntity.trim();
    const url = trimmed ? `/api/reviews?entity=${encodeURIComponent(trimmed)}` : '/api/reviews';
    fetch(url)
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => setReviews([]));
  }, [filterEntity]);

  function toggleEntity(name: string) {
    setSelectedEntities((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  }

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    setUserMsg('');
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: newUserId, password: newUserPassword })
    });

    if (res.ok) {
      setUserMsg('User created.');
      setNewUserId('');
      setNewUserPassword('');
      return;
    }

    const data = await res.json().catch(() => ({}));
    setUserMsg(data.error || 'Failed to create user.');
  }

  async function handleSubmitReview(event: React.FormEvent) {
    event.preventDefault();
    setSubmitMsg('');

    const extraNames = newEntityNames
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const entityPayload = [...new Set([...selectedEntities, ...extraNames])].map((name) => ({
      name
    }));

    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: reviewUserId,
        password: reviewPassword,
        content: reviewContent,
        entities: entityPayload
      })
    });

    if (res.ok) {
      setSubmitMsg('Review saved.');
      setReviewContent('');
      setSelectedEntities([]);
      setNewEntityNames('');
      const entityRes = await fetch('/api/entities');
      const entityData = await entityRes.json().catch(() => ({ entities: [] }));
      setEntities(entityData.entities || []);
      const reviewRes = await fetch('/api/reviews');
      const reviewData = await reviewRes.json().catch(() => ({ reviews: [] }));
      setReviews(reviewData.reviews || []);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setSubmitMsg(data.error || 'Failed to save review.');
  }

  return (
    <>
      <h1>Entity Reviews</h1>

      <section className="section">
        <label htmlFor="entity-search">Filter by linked entity</label>
        <input
          id="entity-search"
          placeholder="Type entity name"
          value={filterEntity}
          onChange={(event) => setFilterEntity(event.target.value)}
          list="entity-suggestions"
        />
        <datalist id="entity-suggestions">
          {entityNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <small>Filtering only matches linked entities, not review text.</small>
      </section>

      <section className="section">
        <h2>Reviews</h2>
        <ul className="list">
          {reviews.map((review) => (
            <li key={review.id}>
              <div>{review.preview}</div>
              <small>user #{review.user_id} · {new Date(review.created_at).toLocaleString()}</small>
              <div>
                {review.entities.map((name) => (
                  <span className="badge" key={name}>{name}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {reviews.length === 0 && <small>No reviews found.</small>}
      </section>

      <section className="section">
        <h2>Create user</h2>
        <form onSubmit={handleCreateUser} className="row">
          <div>
            <label htmlFor="new-user-id">User ID</label>
            <input
              id="new-user-id"
              value={newUserId}
              onChange={(event) => setNewUserId(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="new-user-password">Password</label>
            <input
              id="new-user-password"
              type="password"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit">Create user</button>
          </div>
        </form>
        {userMsg && <small>{userMsg}</small>}
      </section>

      <section className="section">
        <h2>Submit review</h2>
        <form onSubmit={handleSubmitReview}>
          <div className="row">
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

          <div>
            <label>Link existing entities</label>
            <div className="row">
              {entityNames.length === 0 && <small>No entities yet.</small>}
              {entityNames.map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={selectedEntities.includes(name)}
                    onChange={() => toggleEntity(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="new-entities">Add new entities (comma-separated)</label>
            <input
              id="new-entities"
              value={newEntityNames}
              onChange={(event) => setNewEntityNames(event.target.value)}
              placeholder="e.g. Core Engine, Payments"
            />
          </div>

          <button type="submit">Save review</button>
        </form>
        {submitMsg && <small>{submitMsg}</small>}
      </section>
    </>
  );
}
