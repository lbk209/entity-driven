'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import LabelBadgeRow, { buildLabelBadges } from '../components/LabelBadgeRow';
import AuthButton from '../components/AuthButton';
import NodeNameSearch from '../components/NodeNameSearch';
import EntitySummaryRow from '../components/EntitySummaryRow';
import UserSummaryRow from '../components/UserSummaryRow';
import ReviewEntityInput from '../components/ReviewEntityInput';
import { deriveEffectiveUserId, parseReviewFilters } from '@/lib/reviewFilters';
import { useSession } from '../components/useSession';
import ScopeToggle from '../components/ScopeToggle';
import { ENTITY_REVIEW_LABEL_LIMIT, ENTITY_REVIEWS_MAX_ITEMS } from '@/lib/constants';

type Review = {
  id: number;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  content: string;
  entity_name: string;
  entity_id: number | null;
  sentiment?: 'positive' | 'negative';
};

type ReviewLabelRow = {
  label: string;
  all_count: number;
  my_count: number;
};

const REVIEW_PREVIEW_LENGTH = 160;

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
  const reviewItemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const isFetchingRef = useRef(false);
  // Synchronous guard so rapid repeated clicks cannot fire duplicate DELETE requests.
  const isDeletingInFlightRef = useRef(false);
  const lastScrolledReviewIdRef = useRef<number | null>(null);
  const previousSearchParamRef = useRef<string>('');
  const [entitySummary, setEntitySummary] = useState<{
    reviewCount: number | null;
    score: number | null;
    posKeywords: string | null;
    negKeywords: string | null;
  } | null>(null);
  const lastSummaryKeyRef = useRef<string>('');
  const [entityMap, setEntityMap] = useState<Map<number, string>>(new Map());
  const [userSummary, setUserSummary] = useState<{
    displayName: string;
    reviewCount: number | null;
    entityReviewCount: number | null;
    keyEntities: Array<{ name: string; review_count: number }>;
  } | null>(null);
  const [userSummaryError, setUserSummaryError] = useState('');

  const {
    scope: scopeParam,
    label: effectiveLabel,
    nodeId: entityId,
    specificUserId: urlUserId
  } = useMemo(
    () => parseReviewFilters(searchParams),
    [searchParams]
  );
  const effectiveScope = scopeParam ?? 'all';

  const [resolvedEntityName, setResolvedEntityName] = useState('');
  const [reviewQuery, setReviewQuery] = useState('');
  const [entitySearchDraft, setEntitySearchDraft] = useState('');
  const [reviewSearchDraft, setReviewSearchDraft] = useState('');
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingEntityName, setEditingEntityName] = useState('');
  const [editingEntityId, setEditingEntityId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);

  const clearEditingState = useCallback(() => {
    setEditingReviewId(null);
    setEditingContent('');
    setEditingEntityName('');
    setEditingEntityId(null);
    setEditingMessage('');
    setIsSavingEdit(false);
    setIsDeletingReview(false);
  }, []);

  const searchParamString = searchParams.toString();
  const reviewParamValue = searchParams.get('review');
  const requestedReviewId = useMemo(() => {
    if (!reviewParamValue) return null;
    const parsed = Number(reviewParamValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [reviewParamValue]);
  const reviewsQueryString = useMemo(() => {
    const params = new URLSearchParams(searchParamString);
    params.delete('scope');
    params.delete('user_id');
    params.delete('review');
    const serialized = params.toString();
    return serialized ? `?${serialized}` : '';
  }, [searchParamString]);

  useEffect(() => {
    previousSearchParamRef.current = searchParamString;
  }, []);

  const entitySearchValue = useMemo(() => {
    if (entityId !== null) return resolvedEntityName;
    return '';
  }, [entityId, resolvedEntityName]);

  const effectiveUserId = useMemo(
    () =>
      deriveEffectiveUserId({
        scope: effectiveScope,
        specificUserId: urlUserId,
        sessionUserId: user?.user_id
      }),
    [effectiveScope, urlUserId, user?.user_id]
  );

  const scopeForData = !user && scopeParam === 'my' ? 'all' : effectiveScope;
  const isScopeMy = effectiveScope === 'my';
  const isEntityContextActive = entityId !== null;
  const showUserPanel = isScopeMy || Boolean(effectiveUserId);
  const reviewHeaders = useMemo(
    () => (effectiveUserId ? { 'x-review-user-id': effectiveUserId } : undefined),
    [effectiveUserId]
  );

  useEffect(() => {
    setReviewQuery('');
    setReviewSearchDraft('');
    setExpandedReviewId(null);
    clearEditingState();
    lastScrolledReviewIdRef.current = null;
  }, [clearEditingState, entityId]);

  useEffect(() => {
    if (isEntityContextActive) return;
    setEntitySearchDraft(entitySearchValue);
  }, [entitySearchValue, isEntityContextActive]);

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
        const res = await fetch(`/api/reviews${reviewsQueryString}`, {
          headers: reviewHeaders
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
  }, [reviewsQueryString, reviewHeaders, user]);

  const loadMoreReviews = useCallback(async () => {
    if (isFetchingRef.current || isLoading || isLoadingMore) return;
    if (!hasMore || !cursor) return;
    isFetchingRef.current = true;
    setIsLoadingMore(true);
    const params = new URLSearchParams(reviewsQueryString.replace(/^\?/, ''));
    params.set('cursor_created_at', cursor.created_at);
    params.set('cursor_review_id', String(cursor.review_id));
    try {
      const res = await fetch(`/api/reviews?${params.toString()}`, {
        headers: reviewHeaders
      });
      const data = await res.json();
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
    } catch {
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, isLoading, isLoadingMore, reviewHeaders, reviewsQueryString]);

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
      void loadMoreReviews();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMoreReviews, reviews.length]);

  useEffect(() => {
    if (requestedReviewId === null) {
      setExpandedReviewId(null);
      lastScrolledReviewIdRef.current = null;
      return;
    }
    const hasRequestedReview = reviews.some((review) => review.id === requestedReviewId);
    if (hasRequestedReview) {
      setExpandedReviewId(requestedReviewId);
      return;
    }
    setExpandedReviewId(null);
    if (isLoading || !hasMore || !cursor || reviews.length >= ENTITY_REVIEWS_MAX_ITEMS) {
      return;
    }
    void loadMoreReviews();
  }, [cursor, hasMore, isLoading, loadMoreReviews, requestedReviewId, reviews, reviews.length]);

  useEffect(() => {
    if (expandedReviewId === null) return;
    if (lastScrolledReviewIdRef.current === expandedReviewId) return;
    const node = reviewItemRefs.current.get(expandedReviewId);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lastScrolledReviewIdRef.current = expandedReviewId;
  }, [expandedReviewId, reviewQuery, reviews, isEntityContextActive]);

  useEffect(() => {
    if (editingReviewId === null) return;
    if (expandedReviewId === editingReviewId) return;
    clearEditingState();
  }, [clearEditingState, editingReviewId, expandedReviewId]);

  useEffect(() => {
    if (editingReviewId === null) return;
    const stillVisible = reviews.some((review) => review.id === editingReviewId);
    if (stillVisible) return;
    clearEditingState();
  }, [clearEditingState, editingReviewId, reviews]);

  useEffect(() => {
    if (editingReviewId === null) return;
    const editingReview = reviews.find((review) => review.id === editingReviewId);
    if (!editingReview) return;
    if (user?.user_id === editingReview.user_id) return;
    clearEditingState();
  }, [clearEditingState, editingReviewId, reviews, user?.user_id]);

  useEffect(() => {
    const previousSearchParam = previousSearchParamRef.current;
    if (previousSearchParam !== searchParamString && editingReviewId !== null) {
      clearEditingState();
    }
    previousSearchParamRef.current = searchParamString;
  }, [clearEditingState, editingReviewId, searchParamString]);

  useEffect(() => {
    const stickyNode = stickyRef.current;
    if (!stickyNode) return;
    const updateHeight = () => {
      const nextHeight = stickyNode.offsetHeight;
      setStickyHeight(nextHeight);
    };
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(stickyNode);
    return () => observer.disconnect();
  }, []);

  const entityInfo = useMemo(() => {
    if (entityId !== null) {
      const name = resolvedEntityName || `Entity ${entityId}`;
      return { id: entityId, name };
    }
    return null;
  }, [entityId, resolvedEntityName]);

  useEffect(() => {
    if (!entityInfo) {
      setEntitySummary(null);
      lastSummaryKeyRef.current = '';
      return;
    }
    const key = `${entityInfo.id ?? ''}|${entityInfo.name}`;
    if (lastSummaryKeyRef.current === key) return;
    lastSummaryKeyRef.current = key;
    const params = new URLSearchParams();
    if (entityInfo.id !== null) {
      params.set('entity_id', String(entityInfo.id));
    }
    fetch(`/api/node-review-stats?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const stats = (data?.stats ?? []) as Array<{
          node_id: number;
          node_name: string | null;
          review_count: number;
          bayes_score: number;
          pos_keywords: string | null;
          neg_keywords: string | null;
        }>;
        let match = null as (typeof stats)[number] | null;
        if (entityInfo.id !== null) {
          match = stats.find((row) => row.node_id === entityInfo.id) ?? null;
        }
        setEntitySummary(
          match
            ? {
                reviewCount: match.review_count,
                score: match.bayes_score,
                posKeywords: match.pos_keywords,
                negKeywords: match.neg_keywords
              }
            : null
        );
      })
      .catch(() => {
        setEntitySummary(null);
      });
  }, [entityInfo]);

  useEffect(() => {
    let isActive = true;
    if (!effectiveUserId) {
      setUserSummary(null);
      setUserSummaryError(isScopeMy ? 'Sign in to view your user summary.' : '');
      return;
    }
    const params = new URLSearchParams();
    params.set('user_id', effectiveUserId);
    if (entityId !== null) {
      params.set('entity_id', String(entityId));
    }
    fetch(`/api/reviews/user-summary?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load user summary');
        }
        return res.json();
      })
      .then((data) => {
        if (!isActive) return;
        const nextUser = data?.user as
          | {
              user_id: string;
              display_name: string;
              review_count: number;
              entity_review_count: number | null;
              key_entities: Array<{ name: string; review_count: number }>;
            }
          | undefined;
        if (!nextUser) {
          setUserSummary(null);
          setUserSummaryError('No user summary available.');
          return;
        }
        setUserSummary({
          displayName: nextUser.display_name,
          reviewCount: nextUser.review_count,
          entityReviewCount: nextUser.entity_review_count,
          keyEntities: nextUser.key_entities ?? []
        });
        setUserSummaryError('');
      })
      .catch(() => {
        if (!isActive) return;
        setUserSummary(null);
        setUserSummaryError('Failed to load user summary.');
      });
    return () => {
      isActive = false;
    };
  }, [effectiveUserId, entityId, isScopeMy]);


  function updateQuery(next: {
    scope?: string | null;
    label?: string | null;
    entity_id?: string | null;
    user_id?: string | null;
    review?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const currentScope = searchParams.get('scope') ?? null;
    const nextScopeValue = next.scope === undefined ? currentScope : next.scope;
    const isScopeChange = next.scope !== undefined && nextScopeValue !== currentScope;
    const currentEntityId = searchParams.get('entity_id') ?? null;
    const nextEntityIdValue = next.entity_id === undefined ? currentEntityId : next.entity_id;
    const isEntityChange = next.entity_id !== undefined && nextEntityIdValue !== currentEntityId;
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
    if (next.entity_id) {
      params.set('entity_id', next.entity_id);
    } else if (next.entity_id !== undefined) {
      params.delete('entity_id');
    }
    if (isScopeChange) {
      params.delete('user_id');
    } else if (next.user_id) {
      params.set('user_id', next.user_id);
    } else if (next.user_id !== undefined) {
      params.delete('user_id');
    }
    if (next.review) {
      params.set('review', next.review);
    } else if (next.review !== undefined || isEntityChange) {
      params.delete('review');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    let isActive = true;
    if (entityId === null) {
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
  }, [entityId]);

  useEffect(() => {
    let isActive = true;
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        const entities = (data?.entities ?? []) as Array<{ id: number; name: string }>;
        const nextMap = new Map<number, string>();
        entities.forEach((entity) => {
          nextMap.set(entity.id, entity.name);
        });
        setEntityMap(nextMap);
      })
      .catch(() => {
        if (!isActive) return;
        setEntityMap(new Map());
      });
    return () => {
      isActive = false;
    };
  }, []);

  function commitEntitySelection(entity: { id: number; name: string }) {
    setResolvedEntityName(entity.name);
    setReviewQuery('');
    setReviewSearchDraft('');
    setEntitySearchDraft('');
    updateQuery({
      entity_id: String(entity.id),
      review: null
    });
  }

  function clearEntitySelection() {
    setResolvedEntityName('');
    setEntitySearchDraft('');
    updateQuery({
      entity_id: null,
      review: null
    });
  }

  const filteredReviews = useMemo(() => {
    if (!isEntityContextActive) return reviews;
    const query = reviewQuery.trim().toLowerCase();
    if (!query) return reviews;
    return reviews.filter((review) => review.content.toLowerCase().includes(query));
  }, [isEntityContextActive, reviewQuery, reviews]);

  function renderHighlightedText(text: string, query: string) {
    const trimmed = query.trim();
    if (!trimmed) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const parts: React.ReactNode[] = [];
    let startIndex = 0;
    let matchIndex = lowerText.indexOf(lowerQuery);
    while (matchIndex !== -1) {
      if (matchIndex > startIndex) {
        parts.push(text.slice(startIndex, matchIndex));
      }
      parts.push(
        <mark key={`${matchIndex}-${lowerQuery}`} className="review-highlight">
          {text.slice(matchIndex, matchIndex + lowerQuery.length)}
        </mark>
      );
      startIndex = matchIndex + lowerQuery.length;
      matchIndex = lowerText.indexOf(lowerQuery, startIndex);
    }
    if (startIndex < text.length) {
      parts.push(text.slice(startIndex));
    }
    return parts;
  }

  const handleReviewToggle = useCallback(
    (review: Review) => {
      const isExpanded = expandedReviewId === review.id;
      updateQuery({ review: isExpanded ? null : String(review.id) });
    },
    [expandedReviewId, updateQuery]
  );

  const startEditingReview = useCallback((review: Review) => {
    setEditingReviewId(review.id);
    setEditingContent(review.content);
    setEditingEntityName(review.entity_name);
    setEditingEntityId(review.entity_id);
    setEditingMessage('');
  }, []);

  const cancelEditingReview = useCallback(() => {
    clearEditingState();
  }, [clearEditingState]);

  const deleteReview = useCallback(
    async (review: Review) => {
      if (isDeletingReview || isDeletingInFlightRef.current) return;
      if (!window.confirm('Delete this review?')) return;
      setEditingMessage('');
      isDeletingInFlightRef.current = true;
      setIsDeletingReview(true);
      try {
        const res = await fetch(`/api/review?id=${review.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setEditingMessage(data.error || 'Failed to delete review.');
          return;
        }
        setReviews((prev) => prev.filter((item) => item.id !== review.id));
        clearEditingState();
        setExpandedReviewId((prev) => (prev === review.id ? null : prev));
        if (requestedReviewId === review.id) {
          updateQuery({ review: null });
        }
      } catch {
        // Keep state consistent on transport/runtime failures and avoid unhandled rejections.
        setEditingMessage('Failed to delete review.');
      } finally {
        isDeletingInFlightRef.current = false;
        setIsDeletingReview(false);
      }
    },
    [clearEditingState, isDeletingReview, requestedReviewId, updateQuery]
  );

  const saveEditedReview = useCallback(
    async (review: Review) => {
      if (isSavingEdit) return;
      const nextContent = editingContent.trim();
      const nextEntityName = editingEntityName.trim();
      if (!nextContent) {
        setEditingMessage('Review text is required.');
        return;
      }
      setEditingMessage('');
      setIsSavingEdit(true);
      try {
        const res = await fetch(`/api/review?id=${review.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: nextContent,
            entity_name: nextEntityName,
            entity_id: editingEntityId
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setEditingMessage(data.error || 'Failed to save review.');
          return;
        }
        const now = new Date().toISOString();
        setReviews((prev) =>
          prev.map((item) =>
            item.id === review.id
              ? {
                  ...item,
                  content: nextContent,
                  entity_name: nextEntityName,
                  entity_id: editingEntityId,
                  updated_at: now
                }
              : item
          )
        );
        clearEditingState();
      } finally {
        setIsSavingEdit(false);
      }
    },
    [clearEditingState, editingContent, editingEntityId, editingEntityName, isSavingEdit]
  );

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
            {isEntityContextActive ? (
              <NodeNameSearch
                value={reviewQuery}
                inputValue={reviewSearchDraft}
                onInputValueChange={setReviewSearchDraft}
                onCommit={(value) => setReviewQuery(value)}
                onClear={() => {
                  setReviewSearchDraft('');
                  setReviewQuery('');
                }}
                placeholder="Search review text"
              />
            ) : (
              <NodeNameSearch
                mode="entity"
                value={entitySearchValue}
                inputValue={entitySearchDraft}
                onInputValueChange={setEntitySearchDraft}
                onCommit={commitEntitySelection}
                onClear={() => {
                  clearEntitySelection();
                }}
                placeholder="Type entity name"
              />
            )}
          </div>
        </section>
        {isScopeMy && showUserPanel && (
          <section className="section">
            <div className="entity-summary-panel">
              {userSummary ? (
                <UserSummaryRow
                  displayName={userSummary.displayName}
                  reviewCount={userSummary.reviewCount}
                  entityReviewCount={userSummary.entityReviewCount}
                  keyEntities={userSummary.keyEntities}
                  entityContextName={entityInfo?.name ?? null}
                />
              ) : (
                <small>{userSummaryError || 'Loading user summary...'}</small>
              )}
            </div>
          </section>
        )}
        {entityInfo && (
          <section className="section">
            <div className="entity-summary-panel">
              <button
                type="button"
                className="entity-summary-close"
                aria-label="Close entity summary"
                onClick={() => {
                  clearEntitySelection();
                }}
              >
                ×
              </button>
              <EntitySummaryRow
                name={entityInfo.name}
                posKeywords={entitySummary?.posKeywords ?? ''}
                negKeywords={entitySummary?.negKeywords ?? ''}
                reviewCount={entitySummary?.reviewCount ?? null}
                score={entitySummary?.score ?? null}
              />
            </div>
          </section>
        )}
        {!isScopeMy && showUserPanel && (
          <section className="section">
            <div className="entity-summary-panel">
              <button
                type="button"
                className="entity-summary-close"
                aria-label="Close user summary"
                onClick={() => {
                  updateQuery({ user_id: null });
                }}
              >
                ×
              </button>
              {userSummary ? (
                <UserSummaryRow
                  displayName={userSummary.displayName}
                  reviewCount={userSummary.reviewCount}
                  entityReviewCount={userSummary.entityReviewCount}
                  keyEntities={userSummary.keyEntities}
                  entityContextName={entityInfo?.name ?? null}
                />
              ) : (
                <small>{userSummaryError || 'Loading user summary...'}</small>
              )}
            </div>
          </section>
        )}
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
            filteredReviews.map((review) => {
              const reviewEntityId = review.entity_id;
              const isExpanded = expandedReviewId === review.id;
              const isEditing = editingReviewId === review.id;
              const isAuthor = Boolean(user && user.user_id === review.user_id);
              const entityLabel =
                reviewEntityId !== null ? entityMap.get(reviewEntityId) ?? `Entity ${reviewEntityId}` : 'Unknown';
              const previewSlice = review.content.slice(0, REVIEW_PREVIEW_LENGTH);
              const remainingSlice = review.content.slice(REVIEW_PREVIEW_LENGTH);
              const previewText =
                isEntityContextActive && reviewQuery.trim()
                  ? renderHighlightedText(previewSlice, reviewQuery)
                  : previewSlice;
              return (
                <li
                  key={review.id}
                  className={isExpanded ? 'review-item review-item--expanded list-row' : 'review-item list-row'}
                  ref={(node) => {
                    if (!node) {
                      reviewItemRefs.current.delete(review.id);
                      return;
                    }
                    reviewItemRefs.current.set(review.id, node);
                  }}
                >
                  <div className="review-body">
                    {isEditing ? (
                      <div className="review-edit-panel">
                        <div className="review-edit-header">
                          <div className="review-edit-entity">
                            <ReviewEntityInput
                              id={`edit-entity-input-${review.id}`}
                              value={editingEntityName}
                              entityId={editingEntityId}
                              onChange={({ entity_name, entity_id }) => {
                                setEditingEntityName(entity_name);
                                setEditingEntityId(entity_id);
                              }}
                              disabled={isEntityContextActive}
                              required
                              ariaLabel="Entity name"
                            />
                          </div>
                          <div className="review-controls">
                            <button
                              type="button"
                              className="review-control-button"
                              title="Save"
                              aria-label="Save"
                              onClick={(event) => {
                                event.stopPropagation();
                                void saveEditedReview(review);
                              }}
                              disabled={isSavingEdit || isDeletingReview}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="review-control-button"
                              title="Cancel"
                              aria-label="Cancel"
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelEditingReview();
                              }}
                              disabled={isSavingEdit || isDeletingReview}
                            >
                              ✕
                            </button>
                            <button
                              type="button"
                              className="review-control-button review-control-button--danger"
                              title="Delete"
                              aria-label="Delete"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteReview(review);
                              }}
                              disabled={isSavingEdit || isDeletingReview}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={editingContent}
                          onChange={(event) => setEditingContent(event.target.value)}
                          className="review-edit-textarea"
                        />
                        {editingMessage && <small>{editingMessage}</small>}
                      </div>
                    ) : (
                      <>
                        <div
                          className="review-content-trigger"
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onClick={() => handleReviewToggle(review)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            handleReviewToggle(review);
                          }}
                        >
                          <span className="review-text review-preview">
                            {reviewEntityId !== null ? (
                              <span
                                className="badge badge--filter"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  commitEntitySelection({
                                    id: reviewEntityId,
                                    name: entityLabel
                                  });
                                }}
                              >
                                {entityLabel}
                              </span>
                            ) : (
                              <span className="badge badge--muted" aria-disabled="true">
                                {entityLabel}
                              </span>
                            )}
                            {review.sentiment && (
                              <span
                                className={`review-sentiment review-sentiment--${review.sentiment}`}
                                aria-label={`${review.sentiment} sentiment`}
                              >
                                {review.sentiment === 'positive' ? '😊' : '☹️'}
                              </span>
                            )}
                            <span
                              className="review-link review-preview-text"
                              aria-current={isExpanded ? 'true' : undefined}
                            >
                              {previewText}
                            </span>
                            {isExpanded && remainingSlice && (
                              <span className="review-remainder-text">{remainingSlice}</span>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="review-footer-row">
                    <small className="review-meta">
                      <button
                        type="button"
                        className="review-user"
                        onClick={() => updateQuery({ user_id: review.user_id })}
                      >
                        {review.user_id}
                      </button>{' '}
                      ·{' '}
                      {new Date(review.updated_at ?? review.created_at).toLocaleString()}
                    </small>
                    {isExpanded && isAuthor && !isEditing && (
                      <div className="review-controls">
                        <button
                          type="button"
                          className="review-control-button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditingReview(review);
                          }}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!isLoading && !error && filteredReviews.length === 0 && <small>No reviews found.</small>}
          <div ref={loadMoreRef} />
          {isLoadingMore && <small>Loading more...</small>}
        </div>
      </section>
    </>
  );
}
