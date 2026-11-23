'use client';

import React from 'react';
import { buildUrl, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  const rebuilt = buildUrl(state.input, state.currentParams);
  return (
    <div className="h-full space-y-6 overflow-y-auto p-4 text-sm" data-testid="url-parser-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Editor</h3>
        <div className="flex flex-col gap-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="edit-mode"
              checked={state.editMode === 'input'}
              onChange={() => onChange({ ...state, editMode: 'input' })}
              data-testid="mode-input"
            />
            URL input
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="edit-mode"
              checked={state.editMode === 'query'}
              onChange={() => onChange({ ...state, editMode: 'query' })}
              data-testid="mode-query"
            />
            Query params
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Current URL</h3>
        <p
          className="break-all font-mono text-xs text-gray-600 dark:text-gray-300"
          data-testid="sidebar-current-url"
        >
          {rebuilt || state.input || '—'}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved parses</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Tips</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>Default ports (http 80, https 443) are shown even when omitted.</li>
          <li>
            Percent-encoded components are decoded for display; use the inspector for raw forms.
          </li>
          <li>Edit, add, remove or reorder query params and watch the URL rebuild live.</li>
          <li>Parse state is stored in the URL hash for link sharing.</li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
