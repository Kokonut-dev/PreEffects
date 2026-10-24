import React, { useEffect, useRef, useState } from 'react';
import { evaluateNumericMathInput } from '../../utils/qolHelpers';

interface ScrubNumberInputProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel?: string;
}

export const ScrubNumberInput: React.FC<ScrubNumberInputProps> = ({
  value,
  onChange,
  step = 1,
  min = -100000,
  max = 100000,
  suffix = '',
  ariaLabel,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(value * 100) / 100));
  const dragRef = useRef<{ startX: number; startVal: number } | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(Math.round(value * 100) / 100));
    }
  }, [value, editing]);

  const clampVal = (n: number) => Math.max(min, Math.min(max, n));

  const commitDraft = () => {
    setEditing(false);
    const evaluated = clampVal(evaluateNumericMathInput(draft, value));
    onChange(Math.round(evaluated * 100) / 100);
  };

  if (editing) {
    return (
      <input
        autoFocus
        aria-label={ariaLabel}
        className="studio-input mono"
        style={{ width: '100%', padding: '2px 5px', fontSize: 11, textAlign: 'right' }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuenow={value}
      className="scrub-number"
      title="Drag horizontally to scrub (Shift=10×, Alt=0.1×) or click to type math like 1920/2"
      style={{ width: '100%', fontSize: 11 }}
      onClick={() => {
        if (!dragRef.current) {
          setDraft(String(Math.round(value * 100) / 100));
          setEditing(true);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') setEditing(true);
        if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clampVal(value + step)); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clampVal(value - step)); }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const startX = e.clientX;
        const startVal = value;
        let moved = false;

        const onMove = (me: PointerEvent) => {
          const dx = me.clientX - startX;
          if (Math.abs(dx) > 2) moved = true;
          if (!moved) return;
          dragRef.current = { startX, startVal };
          const mult = me.shiftKey ? 10 : me.altKey ? 0.1 : 1;
          const next = clampVal(startVal + dx * step * mult);
          onChange(Math.round(next * 100) / 100);
        };

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          setTimeout(() => {
            dragRef.current = null;
          }, 30);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      }}
    >
      {Math.round(value)}
      {suffix}
    </span>
  );
};
