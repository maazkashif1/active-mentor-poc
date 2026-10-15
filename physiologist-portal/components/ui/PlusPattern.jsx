'use client';
import { useId } from 'react';

export default function PlusPattern() {
  const id = `plus-${useId().replace(/:/g, '')}`;
  return (
    <svg className="plus-pattern" aria-hidden="true">
      <defs>
        <pattern id={id} width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M14 9.5v9M9.5 14h9" stroke="white" strokeOpacity="0.07" strokeWidth="1.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
