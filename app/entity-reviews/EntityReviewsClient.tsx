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
import { ENTITY_REVIEW_LABEL_LIMIT, ENTITY_REVIEWS_MAX_ITEMS } from '@/lib/constants';

type Review = {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  preview: string;
  entity_name: string;
  entity_id: number | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  all_count: number;
  my_count: number;
};

export default function EntityReviewsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [labels, setLabels] = useState<ReviewLabelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<{ created_at: string; review_id: number } | null>(null);
  const [stickyHeight, setStickyHeight] = useState(0);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);
  const navigationRef = useRef(false);

  const {
    scope: scopeParam,
    label: effectiveLabel,
    nodeId: entityId,
    nodeName: entityNameParam
  } = useMemo(
    () => parseReviewFilters(searchParams),
    [searchParams]
  );
  const effectiveScope = scopeParam ?? 'all';

  const [resolvedEntityName, setResolvedEntityName] = useState('');
  const [specificUserId, setSpecificUserId] = useState<string | null>(null);

  const searchParamString = searchParams.toString();
  const detailQueryString = useMemo(() => {
    return searchParamString ? `?${searchParamString}` : '';
  }, [searchParamString]);
  const queryString = useMemo(() => {
    return searchParamString ? `?${searchParamString}` : '';
  }, [searchParamString]);

  const entitySearchValue = useMemo(() => {
    if (entityNameParam) return entityNameParam;
    if (entityId !== null) return resolvedEntityName;
    return '';
  }, [entityId, entityNameParam, resolvedEntityName]);

  const hasSpecificUserFilter = Boolean(specificUserId);

  const scopeForData = !user && scopeParam === 'my' ? 'all' : effectiveScope;

  useEffect(() => {
    if (!searchParams.get('user_id')) return;
    const params = new URLSearchParams(searchParamString);
    params.delete('user_id');
    const query = params.toString();
    navigationRef.current = true;
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParamString, searchParams]);

  const topEntitiesHref = useMemo(() => {
    const scopeValue = searchParams.get('scope');
    return scopeValue ? `/node-review-stats?scope=${scopeValue}` : '/node-review-stats';
  }, [searchParams]);

  const allLabelBadges = useMemo(
    () => buildLabelBadges(labels, ENTITY_REVIEW_LABEL_LIMIT, scopeForData),
    [labels, scopeForData]
  );

  useEffect(() => {
    let isActive = true;
    const loadInitial = async () => {
      setIsLoading(true);
      setError('');
      setCursor(null);
      setHasMore(true);
      try {
        const res = await fetch(`/api/reviews${queryString}`, {
          headers: specificUserId ? { 'x-review-user-id': specificUserId } : undefined
        });
        const data = await res.json();
        if (!isActive) return;
        setReviews(data.reviews || []);
        setLabels(data.labels || []);
        setCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.nextCursor));
      } catch {
        if (!isActive) return;
        setReviews([]);
        setLabels([]);
        setError('Failed to load reviews.');
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    };
    loadInitial();
    return () => {
      isActive = false;
    };
  }, [queryString, specificUserId, user]);

  useEffect(() => {
    if (!hasMore) return;
    if (reviews.length >= ENTITY_REVIEWS_MAX_ITEMS) {
      setHasMore(false);
      return;
    }
    const node = loadMoreRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (isFetchingRef.current || isLoading || isLoadingMore) return;
      if (!hasMore || !cursor) return;
      isFetchingRef.current = true;
      setIsLoadingMore(true);
      const params = new URLSearchParams(queryString.replace(/^\?/, ''));
      params.set('cursor_created_at', cursor.created_at);
      params.set('cursor_review_id', String(cursor.review_id));
      fetch(`/api/reviews?${params.toString()}`, {
        headers: specificUserId ? { 'x-review-user-id': specificUserId } : undefined
      })
        .then((res) => res.json())
        .then((data) => {
          setReviews((prev) => {
            const next = [...prev, ...(data.reviews ?? [])];
            return next.slice(0, ENTITY_REVIEWS_MAX_ITEMS);
          });
          if (data.nextCursor) {
            setCursor(data.nextCursor);
            setHasMore(true);
          } else {
            setHasMore(false);
          }
        })
        .catch(() => {
          setHasMore(false);
        })
        .finally(() => {
          isFetchingRef.current = false;
          setIsLoadingMore(false);
        });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, queryString, hasMore, isLoading, isLoadingMore, reviews.length, specificUserId]);

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
    scope?: string | null;
    label?: string | null;
    entity_name?: string | null;
    entity?: string | null;
    entity_id?: string | null;
  }) {
    // Prefer entity_* query params.
    const params = new URLSearchParams(searchParams.toString());
    if (next.scope) {
      params.set('scope', next.scope);
    } else if (next.scope === null) {
      params.delete('scope');
    }
    if (!next.label || next.label.toLowerCase() === 'all') {
      params.delete('label');
    } else {
      params.set('label', next.label);
    }
    if (next.entity_name) {
      params.set('entity_name', next.entity_name);
    } else if (next.entity_name !== undefined) {
      params.delete('entity_name');
    }
    if (next.entity) {
      params.set('entity', next.entity);
    } else if (next.entity !== undefined) {
      params.delete('entity');
    }
    if (next.entity_id) {
      params.set('entity_id', next.entity_id);
    } else if (next.entity_id !== undefined) {
      params.delete('entity_id');
    }
    const query = params.toString();
    navigationRef.current = true;
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (navigationRef.current) {
      navigationRef.current = false;
      return;
    }
    setSpecificUserId(null);
  }, [searchParams]);

  useEffect(() => {
    let isActive = true;
    if (entityId === null || entityNameParam) {
      setResolvedEntityName('');
      return;
    }
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        const entities = (data?.entities ?? []) as Array<{ id: number; name: string }>;
        const match = entities.find((entity) => entity.id === entityId);
        setResolvedEntityName(match?.name ?? '');
      })
      .catch(() => {
        if (!isActive) return;
        setResolvedEntityName('');
      });
    return () => {
      isActive = false;
    };
  }, [entityId, entityNameParam]);

  return (
    <>
      <div className="sticky-panel" ref={stickyRef}>
        <div className="page-header">
          <div>
            <h1>Entity Reviews</h1>
            <small>Explore reviews across entities.</small>
          </div>
          <div className="page-header__actions">
            <div className="button-row">
              <Link href={topEntitiesHref} className="button-link">
                Top Entities
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
              value={user ? effectiveScope : 'all'}
              disabled={!user}
              onChange={(scope) => {
                setSpecificUserId(null);
                updateQuery({ scope, label: effectiveLabel });
              }}
            />
            <LabelBadgeRow
              badges={allLabelBadges}
              selectedLabel={effectiveLabel}
              onSelect={(label) => updateQuery({ label })}
            />
          </div>
          <div className="filter-row">
            <NodeNameSearch
              value={entitySearchValue}
              onCommit={(value) =>
                updateQuery({
                  entity_name: value.trim() ? value : null,
                  entity: null,
                  entity_id: null
                })
              }
              onClear={() => {
                setSpecificUserId(null);
                updateQuery({
                  entity_name: null,
                  entity: null,
                  entity_id: null
                });
              }}
              forceClear={hasSpecificUserFilter}
              placeholder={
                hasSpecificUserFilter
                  ? 'Filtered by user'
                  : 'Type entity name'
              }
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
              const reviewEntityId = review.entity_id;
              const entityLabel = review.entity_name;
              return (
                <li key={review.id}>
                  <div className="review-line">
                    <span className="review-preview">
                      <span
                        className="badge badge--filter"
                        onClick={() => {
                          if (reviewEntityId === null) return;
                          updateQuery({
                            entity_id: String(reviewEntityId),
                            entity: null,
                            entity_name: null
                          });
                        }}
                      >
                        {entityLabel}
                      </span>
                      {review.sentiment && (
                        <span
                          className={`review-sentiment review-sentiment--${review.sentiment}`}
                          aria-label={`${review.sentiment} sentiment`}
                        >
                          {review.sentiment === 'positive' ? '😊' : '☹️'}
                        </span>
                      )}
                      <Link
                        className="review-link"
                        href={`/reviews/${review.id}${detailQueryString}`}
                      >
                        {review.preview}
                      </Link>
                    </span>
                  </div>
                  <small className="review-meta">
                    <button
                      type="button"
                      className="review-user"
                      onClick={() => setSpecificUserId(review.user_id)}
                    >
                      {review.user_id}
                    </button>{' '}
                    ·{' '}
                    {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                  </small>
                </li>
              );
            })}
          </ul>
          {!isLoading && !error && reviews.length === 0 && <small>No reviews found.</small>}
          <div ref={loadMoreRef} />
          {isLoadingMore && <small>Loading more...</small>}
        </div>
      </section>
    </>
  );
}
