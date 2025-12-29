'use client';

import Link from 'next/link';
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
  user_id: string;
  created_at: string;
  updated_at: string | null;
  preview: string;
  entities: string[];
};

export default function HomePage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filterEntity, setFilterEntity] = useState('');

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

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Entity Reviews</h1>
          <small>Browse recent reviews and filter by linked entity.</small>
        </div>
        <Link href="/reviews/new" className="button-link">
          Write review
        </Link>
      </div>

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
              <Link className="review-link" href={`/reviews/${review.id}`}>
                <div className="review-line">
                  {review.entities.map((name) => (
                    <span className="badge" key={name}>{name}</span>
                  ))}
                  <span className="review-preview">{review.preview}</span>
                </div>
                <small className="review-meta">
                  {review.user_id} ·{' '}
                  {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                </small>
              </Link>
            </li>
          ))}
        </ul>
        {reviews.length === 0 && <small>No reviews found.</small>}
      </section>
    </>
  );
}
