'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';

type Entity = {
  id: number;
  name: string;
  type: string;
};

type ReviewEntityInputProps = {
  id: string;
  value: string;
  entityId: number | null;
  onChange: (next: { entity_name: string; entity_id: number | null }) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

export default function ReviewEntityInput({
  id,
  value,
  entityId,
  onChange,
  placeholder = 'Type an entity name',
  required = false,
  disabled = false,
  ariaLabel = 'Entity'
}: ReviewEntityInputProps) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditingSelected, setIsEditingSelected] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const suggestionEntities = useMemo(() => {
    const inputValue = value.trim().toLowerCase();
    if (!inputValue) return [];
    return entities
      .filter((entity) => entity.name.toLowerCase().includes(inputValue))
      .slice(0, 20);
  }, [entities, value]);

  useEffect(() => {
    let isActive = true;
    fetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (!isActive) return;
        setEntities(data?.entities ?? []);
      })
      .catch(() => {
        if (!isActive) return;
        setEntities([]);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (entityId === null) {
      setIsEditingSelected(true);
      return;
    }
    setIsEditingSelected(false);
  }, [entityId]);

  const showSelectedBadge =
    entityId !== null && !isEditingSelected && value.trim().length > 0;

  return (
    <div
      className={`entity-input-wrap ${showSelectedBadge ? 'entity-input-wrap--selected' : ''}`}
    >
      {showSelectedBadge && (
        <button
          type="button"
          className="badge badge--filter"
          onMouseDown={(event) => {
            event.preventDefault();
            if (disabled) return;
            setIsEditingSelected(true);
            requestAnimationFrame(() => {
              const input = inputRef.current;
              if (!input) return;
              input.focus();
              const cursor = input.value.length;
              input.setSelectionRange(cursor, cursor);
            });
          }}
          disabled={disabled}
          aria-label={disabled ? `${value}` : `Edit ${value}`}
        >
          {value}
        </button>
      )}
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => {
          onChange({ entity_name: event.target.value, entity_id: null });
          setIsEditingSelected(true);
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (disabled) return;
          setIsEditingSelected(true);
          setShowSuggestions(true);
        }}
        onBlur={() => setShowSuggestions(false)}
        placeholder={placeholder}
        className="entity-input"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={!disabled && showSuggestions && suggestionEntities.length > 0}
        aria-controls={`${id}-suggestion-list`}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
      />
      {!disabled && showSuggestions && suggestionEntities.length > 0 && (
        <div className="entity-suggestions" role="listbox" id={`${id}-suggestion-list`}>
          {suggestionEntities.map((entity) => (
            <button
              type="button"
              key={entity.id}
              role="option"
              className={entityId === entity.id ? 'is-selected' : ''}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange({ entity_name: entity.name, entity_id: entity.id });
                setIsEditingSelected(false);
                setShowSuggestions(false);
              }}
            >
              {entity.name} ({entity.type})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
