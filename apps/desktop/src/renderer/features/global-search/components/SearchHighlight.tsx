import React from 'react';
import { SearchHighlightRange } from '../types.js';

interface SearchHighlightProps {
  text: string;
  ranges?: SearchHighlightRange[];
  className?: string;
  highlightClassName?: string;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({
  text,
  ranges,
  className = '',
  highlightClassName = 'bg-primary/20 text-primary font-semibold rounded-sm px-0.5',
}) => {
  if (!ranges || ranges.length === 0 || !text) {
    return <span className={className}>{text}</span>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];

    // Ensure valid bounds
    const safeStart = Math.max(0, Math.min(start, text.length));
    const safeEnd = Math.max(safeStart, Math.min(end, text.length));

    // Text before the highlight
    if (safeStart > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>{text.substring(lastIndex, safeStart)}</span>
      );
    }

    // Highlighted text
    if (safeEnd > safeStart) {
      elements.push(
        <mark key={`hl-${safeStart}-${safeEnd}`} className={highlightClassName}>
          {text.substring(safeStart, safeEnd)}
        </mark>
      );
    }

    lastIndex = safeEnd;
  }

  // Trailing text after the last highlight
  if (lastIndex < text.length) {
    elements.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
  }

  return <span className={className}>{elements}</span>;
};

