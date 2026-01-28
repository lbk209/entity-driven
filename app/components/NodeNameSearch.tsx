'use client';

import { useEffect, useState } from 'react';

type NodeNameSearchProps = {
  value: string;
  onCommit: (value: string) => void;
  onClear: () => void;
  forceClear?: boolean;
  placeholder?: string;
};

export default function NodeNameSearch({
  value,
  onCommit,
  onClear,
  forceClear = false,
  placeholder = 'Type node name'
}: NodeNameSearchProps) {
  const [draft, setDraft] = useState(value);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const hasCommittedValue = value.trim().length > 0;
  const draftTrimmed = draft.trim();
  const showClear =
    (hasCommittedValue && draftTrimmed === value.trim()) ||
    (forceClear && !hasCommittedValue && !draftTrimmed);

  function commitDraft() {
    if (isComposing) return;
    onCommit(draft);
  }

  return (
    <>
      <div className="entity-input-wrap">
        <input
          id="node-search"
          aria-label="Filter by node name"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitDraft();
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
        />
      </div>
      {showClear ? (
        <button
          className="clear-button"
          type="button"
          onClick={() => {
            setDraft('');
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
          disabled={!draftTrimmed}
        >
          OK
        </button>
      )}
    </>
  );
}
