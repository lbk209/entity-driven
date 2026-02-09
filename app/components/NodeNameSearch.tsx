'use client';

import { useEffect, useMemo, useState } from 'react';

type EntityOption = {
  id: number;
  name: string;
  type?: string;
};

type BaseProps = {
  value: string;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  onClear: () => void;
  forceClear?: boolean;
  placeholder?: string;
  readOnly?: boolean;
};

type FreeformProps = BaseProps & {
  mode?: 'freeform';
  onCommit: (value: string) => void;
};

type EntityProps = BaseProps & {
  mode: 'entity';
  onCommit: (entity: EntityOption) => void;
};

type NodeNameSearchProps = FreeformProps | EntityProps;

export default function NodeNameSearch(props: NodeNameSearchProps) {
  const {
    value,
    inputValue,
    onInputValueChange,
    onClear,
    forceClear = false,
    placeholder = 'Type entity name',
    readOnly = false
  } = props;
  const [draft, setDraft] = useState(value);
  const [isComposing, setIsComposing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isEntityMode = props.mode === 'entity';
  const isControlled = typeof onInputValueChange === 'function';
  const draftValue = isControlled ? inputValue ?? '' : draft;

  useEffect(() => {
    if (isControlled) return;
    setDraft(value);
  }, [isControlled, value]);

  useEffect(() => {
    if (!isEntityMode) return;
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => setEntities(data.entities || []))
      .catch(() => setEntities([]));
  }, [isEntityMode]);

  const matches = useMemo(() => {
    if (!isEntityMode) return [];
    const query = draftValue.trim().toLowerCase();
    if (!query) return [];
    return entities
      .filter((entity) => entity.name.toLowerCase().includes(query))
      .slice(0, 20);
  }, [draftValue, entities, isEntityMode]);

  useEffect(() => {
    if (!isEntityMode || !isControlled) return;
    if (!draftValue.trim()) {
      setSelectedIndex(null);
      setShowSuggestions(false);
    }
  }, [draftValue, isControlled, isEntityMode]);

  useEffect(() => {
    if (!isEntityMode) return;
    if (matches.length === 1) {
      setSelectedIndex(0);
      return;
    }
    if (matches.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedIndex === null) return;
    if (!matches[selectedIndex]) {
      setSelectedIndex(null);
    }
  }, [matches, isEntityMode, selectedIndex]);

  const hasCommittedValue = value.trim().length > 0;
  const draftTrimmed = draftValue.trim();
  const showClear =
    (hasCommittedValue && draftTrimmed === value.trim()) ||
    (forceClear && !hasCommittedValue && !draftTrimmed);

  const selectedEntity =
    isEntityMode && selectedIndex !== null ? matches[selectedIndex] ?? null : null;

  const canCommit = isEntityMode
    ? Boolean(selectedEntity)
    : Boolean(draftTrimmed);

  function commitDraft() {
    if (isComposing) return;
    if (props.mode === 'entity') {
      if (!selectedEntity) return;
      props.onCommit(selectedEntity);
      setShowSuggestions(false);
      return;
    }
    props.onCommit(draftValue);
  }

  function handleArrowMove(direction: 'up' | 'down') {
    if (!isEntityMode || matches.length === 0) return;
    setSelectedIndex((prev) => {
      if (prev === null) {
        return direction === 'down' ? 0 : matches.length - 1;
      }
      if (direction === 'down') {
        return prev >= matches.length - 1 ? 0 : prev + 1;
      }
      return prev <= 0 ? matches.length - 1 : prev - 1;
    });
  }

  return (
    <>
      <div className="entity-input-wrap">
        <input
          id="node-search"
          aria-label="Filter by entity name"
          placeholder={placeholder}
          value={draftValue}
          onChange={(event) => {
            if (readOnly) return;
            const nextValue = event.target.value;
            if (isControlled) {
              onInputValueChange?.(nextValue);
            } else {
              setDraft(nextValue);
            }
            if (isEntityMode) {
              setShowSuggestions(true);
              setSelectedIndex(null);
            }
          }}
          onFocus={() => {
            if (isEntityMode) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            if (isEntityMode) {
              setShowSuggestions(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (canCommit) {
                commitDraft();
              }
              return;
            }
            if (!isEntityMode) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              handleArrowMove('down');
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              handleArrowMove('up');
              return;
            }
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          readOnly={readOnly}
          autoComplete="off"
          role={isEntityMode ? 'combobox' : undefined}
          aria-autocomplete={isEntityMode ? 'list' : undefined}
          aria-expanded={isEntityMode ? showSuggestions && matches.length > 0 : undefined}
          aria-controls={isEntityMode ? 'entity-suggestion-list' : undefined}
          aria-activedescendant={
            isEntityMode && selectedIndex !== null
              ? `entity-suggestion-${selectedIndex}`
              : undefined
          }
        />
        {isEntityMode && showSuggestions && matches.length > 0 && (
          <div className="entity-suggestions" role="listbox" id="entity-suggestion-list">
            {matches.map((entity, index) => (
              <button
                type="button"
                key={entity.id}
                id={`entity-suggestion-${index}`}
                role="option"
                className={selectedIndex === index ? 'is-selected' : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  setSelectedIndex(index);
                  if (isControlled) {
                    onInputValueChange?.(entity.name);
                  } else {
                    setDraft(entity.name);
                  }
                  setShowSuggestions(true);
                }}
              >
                {entity.name}
                {entity.type ? ` (${entity.type})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      {showClear ? (
        <button
          className="clear-button"
          type="button"
          onClick={() => {
            if (isControlled) {
              onInputValueChange?.('');
            } else {
              setDraft('');
            }
            setSelectedIndex(null);
            onClear();
          }}
        >
          Clear
        </button>
      ) : (
        <button
          className="clear-button"
          type="button"
          onClick={commitDraft}
          disabled={!canCommit}
        >
          OK
        </button>
      )}
    </>
  );
}
