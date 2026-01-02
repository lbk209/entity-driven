'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type Entity = {
  id: number;
  name: string;
  type: string;
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
  const [filterUser, setFilterUser] = useState('');
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);

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
    const userTrimmed = filterUser.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('entity', trimmed);
    if (userTrimmed) params.set('user', userTrimmed);
    const query = params.toString();
    const url = query ? `/api/reviews?${query}` : '/api/reviews';
    fetch(url)
      .then((res) => res.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => setReviews([]));
  }, [filterEntity, filterUser]);

  useEffect(() => {
    const stickyNode = stickyRef.current;
    if (!stickyNode) return;
    const updateHeight = () => {
      const nextHeight = stickyNode.offsetHeight;
      setStickyHeight((prev) => (prev === 0 ? nextHeight : Math.min(prev, nextHeight)));
    };
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(stickyNode);
    return () => observer.disconnect();
  }, []);

  function handleBadgeClick(name: string) {
    setFilterEntity(name);
  }

  function handleUserClick(userId: string) {
    setFilterUser(userId);
  }

  function handleClearFilters() {
    setFilterEntity('');
    setFilterUser('');
  }

  function handleBadgeKeyDown(name: string, event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    handleBadgeClick(name);
  }

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
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
          <div className="filter-row">
            <div className="entity-input-wrap">
              <input
                id="entity-search"
                placeholder="Type entity name"
                value={filterEntity}
                onChange={(event) => {
                  setFilterEntity(event.target.value);
                  setShowEntitySuggestions(true);
                }}
                onFocus={() => setShowEntitySuggestions(true)}
                onBlur={() => setShowEntitySuggestions(false)}
                autoComplete="off"
              />
              {showEntitySuggestions && (
                <div className="entity-suggestions">
                  {entityNames
                    .filter((name) => {
                      if (!filterEntity.trim()) return true;
                      return name.toLowerCase().includes(filterEntity.toLowerCase());
                    })
                    .slice(0, 20)
                    .map((name) => (
                      <button
                        type="button"
                        key={name}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setFilterEntity(name);
                          setShowEntitySuggestions(false);
                        }}
                      >
                        {name}
                      </button>
                    ))}
                </div>
              )}
            </div>
            {(filterEntity.trim() || filterUser.trim()) && (
              <button className="clear-button" type="button" onClick={handleClearFilters}>
                Clear
              </button>
            )}
          </div>
          <small>Filtering only matches linked entities, not review text.</small>
          {filterUser.trim() && (
            <small>Filtering by user: {filterUser.trim()}</small>
          )}
        </section>
      </div>
      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />

      <section
        className="section section--reviews"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        <div className="review-scroll">
          <ul className="list list--snap">
            {reviews.map((review) => (
              <li key={review.id}>
                <div className="review-line">
                  <span className="review-preview">
                    {review.entities.map((name) => (
                      <span
                        className="badge badge--filter"
                        key={name}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleBadgeClick(name);
                        }}
                        onKeyDown={(event) => handleBadgeKeyDown(name, event)}
                      >
                        {name}
                      </span>
                    ))}
                    <Link className="review-link" href={`/reviews/${review.id}`}>
                      {review.preview}
                    </Link>
                  </span>
                </div>
                <small className="review-meta">
                  <button
                    className="review-user"
                    type="button"
                    onClick={() => handleUserClick(review.user_id)}
                  >
                    {review.user_id}
                  </button>{' '}
                  ·{' '}
                  {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
          {reviews.length === 0 && <small>No reviews found.</small>}
        </div>
      </section>
    </>
  );
}
