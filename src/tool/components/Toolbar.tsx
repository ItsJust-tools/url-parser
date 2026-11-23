'use client';

import React from 'react';
import { buildUrl, summaryText, type ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onCopy }) => {
  const rebuilt = buildUrl(state.input, state.currentParams);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2" role="group" aria-label="URL Parser tool controls">
        <button
          type="button"
          onClick={() => onChange({ ...state, input: '', currentParams: [], editMode: 'input' })}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        {onCopy && (state.input || rebuilt) ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy result
          </button>
        ) : null}
      </div>
      <span
        className="hidden font-mono text-xs text-gray-500 sm:block dark:text-gray-400"
        data-testid="toolbar-url-preview"
      >
        {summaryText(state.input, state.currentParams).split('\n')[1] ?? 'No URL'}
      </span>
    </div>
  );
};

export default Toolbar;
