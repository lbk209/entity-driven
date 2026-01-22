'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LabelBadgeRow, { buildLabelBadges } from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import { parseReviewFilters } from '@/lib/reviewFilters';
import { useSession } from '../components/useSession';
import ScopeToggle from '../components/ScopeToggle';
import { ENTITY_REVIEW_LABEL_LIMIT } from '@/lib/constants';

type Review = {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  preview: string;
  entity_name: string;
  node_name: string | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  node_count: number;
};

export default function EntityReviewsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [labels, setLabels] = useState<ReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  const { scope: effectiveScope, label: effectiveLabel, nodeName: nodeNameParam } = useMemo(
    () =>
      parseReviewFilters(searchParams, {
        isLoggedIn: Boolean(user),
        isAdmin: user?.role === 'admin'
      }),
    [searchParams, user]
  );

  const queryString = useMemo(() => {
    const query = searchParams.toString();
    return query ? `?${query}` : '';
  }, [searchParams]);

  const allLabelBadges = useMemo(
    () => buildLabelBadges(labels, ENTITY_REVIEW_LABEL_LIMIT),
    [labels]
  );

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError('');
    fetch(`/api/reviews${queryString}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        setReviews(data.reviews || []);
        setLabels(data.labels || []);
      })
      .catch(() => {
        if (!isActive) return;
        setReviews([]);
        setLabels([]);
        setError('Failed to load reviews.');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [queryString, user]);

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

  function updateQuery(next: {
    scope?: string;
    label?: string | null;
    node_name?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.scope) {
      params.set('scope', next.scope);
    } else {
      params.delete('scope');
    }
    if (!next.label || next.label.toLowerCase() === 'all') {
      params.delete('label');
    } else {
      params.set('label', next.label);
    }
    if (next.node_name) {
      params.set('node_name', next.node_name);
    } else if (next.node_name !== undefined) {
      params.delete('node_name');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Entity Reviews</h1>
            <small>Browse reviews by scope and entity label.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href="/node-review-stats" className="button-link">
                Node review stats
              </Link>
              <Link href="/reviews/new" className="button-link">
                Write review
              </Link>
              <AuthButton />
            </div>
          </div>
        </div>

        <section className="section">
          <div className="filter-row filter-row--inline">
            <ScopeToggle
              value={effectiveScope}
              onChange={(scope) => updateQuery({ scope, label: effectiveLabel })}
            />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ scope: effectiveScope, label })}
            />
          </div>
          <div className="filter-row">
            <NodeNameSearch
              value={nodeNameParam}
              onCommit={(value) =>
                updateQuery({ node_name: value.trim() ? value : null })
              }
              onClear={() => updateQuery({ node_name: null })}
            />
          </div>
        </section>
      </div>

      <div className="sticky-spacer" style={{ height: stickyHeight }} aria-hidden="true" />
      <section
        className="section section--reviews"
        style={{ '--sticky-height': `${stickyHeight}px` } as React.CSSProperties}
      >
        <div className="review-scroll">
          <ul className="list list--snap">
          {isLoading && <small>Loading...</small>}
          {error && <small>{error}</small>}
          {!isLoading &&
            !error &&
            reviews.map((review) => {
              const nodeLabel = review.node_name ?? review.entity_name;
              return (
                <li key={review.id}>
                  <div className="review-line">
                    <span className="review-preview">
                      <span className="badge badge--filter">{nodeLabel}</span>
                      {review.sentiment && (
                        <span
                          className={`review-sentiment review-sentiment--${review.sentiment}`}
                          aria-label={`${review.sentiment} sentiment`}
                        >
                          {review.sentiment === 'positive' ? '😊' : '☹️'}
                        </span>
                      )}
                      <Link className="review-link" href={`/reviews/${review.id}`}>
                        {review.preview}
                      </Link>
                    </span>
                  </div>
                  <small className="review-meta">
                    <span className="review-user">{review.user_id}</span> ·{' '}
                    {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                  </small>
                </li>
              );
            })}
          </ul>
          {!isLoading && !error && reviews.length === 0 && <small>No reviews found.</small>}
        </div>
      </section>
    </>
  );
}
