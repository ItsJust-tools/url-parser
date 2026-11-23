'use client';

import React, { useMemo } from 'react';
import {
  buildUrl,
  parseUrl,
  safeDecode,
  safeEncode,
  urlError,
  type QueryParam,
  type ToolState,
} from '../types';

export const DEFAULT_AMPERSAND_TEST = 'https://example.com/?a=%26b&c=d';

interface CanvasProps {
  state: ToolState;
  onChange?: (next: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-200 py-2 last:border-b-0 dark:border-gray-800">
      <span className="w-24 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-900 dark:text-gray-100">
        {value === null ? <em className="text-gray-400">not present</em> : value}
      </span>
      {value !== null ? <CopyButton value={value} /> : null}
    </div>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const isQueryMode = state.editMode === 'query';
  const error = useMemo(() => urlError(state.input), [state.input]);
  const components = useMemo(
    () =>
      isQueryMode ? parseUrl(state.input, { params: state.currentParams }) : parseUrl(state.input),
    [isQueryMode, state.currentParams, state.input]
  );
  const rebuiltUrl = useMemo(
    () => buildUrl(state.input, state.currentParams),
    [state.input, state.currentParams]
  );

  const handleParse = () => {
    if (error) return;
    onSaveHistory?.(`Parsed ${state.input}`);
  };

  const startQueryEditing = () => {
    const parsed = parseUrl(state.input);
    update({ editMode: 'query', currentParams: parsed.params });
  };

  const handleCopyJson = React.useCallback(async () => {
    try {
      const json = JSON.stringify(
        Object.fromEntries(state.currentParams.map((p) => [p.key, p.value])),
        null,
        2
      );
      await navigator.clipboard.writeText(json);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [state.currentParams]);

  return (
    <div className="p-4" data-testid="url-parser-canvas">
      <div className="mb-4">
        <label
          className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          htmlFor="url-input"
        >
          URL to parse
        </label>
        <input
          id="url-input"
          type="text"
          value={state.input}
          onChange={(e) => update({ input: e.target.value })}
          data-testid="input-url"
          placeholder="https://user:pass@example.com:8080/path/to/page?q=hello&lang=en#section"
          className={inputClass}
        />
        {error ? (
          <p
            className="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
            data-testid="url-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            data-testid="btn-parse"
            className="rounded-md bg-sky-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            Parse URL
          </button>
          {!isQueryMode ? (
            <button
              type="button"
              onClick={startQueryEditing}
              data-testid="btn-edit-query"
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Edit query params
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard.writeText(rebuiltUrl || state.input).catch(() => {})
            }
            data-testid="btn-copy-full-url"
            className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy full URL
          </button>
          <button
            type="button"
            onClick={() => void handleCopyJson()}
            data-testid="btn-copy-params-json"
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
          >
            Copy params as JSON
          </button>
        </div>
      </div>

      {components.valid ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          data-testid="result-card"
        >
          <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Components</h3>
          <div data-testid="component-rows">
            <Row label="protocol" value={components.protocol} />
            <Row label="username" value={components.username} />
            <Row label="password" value={components.password} />
            <Row label="hostname" value={components.hostname} />
            <Row label="port" value={components.port} />
            <Row
              label="path"
              value={
                components.pathSegments && components.pathSegments.length > 0
                  ? '/' +
                    components.pathSegments
                      .map((segment: string) => safeDecode(safeEncode(segment)))
                      .join('/')
                  : components.pathSegments !== null
                    ? '/'
                    : null
              }
            />
            <Row label="hash" value={components.hash} />
          </div>

          <div className="mt-4" data-testid="percent-encoding-inspector">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Percent-encoding inspector
            </h4>
            <div className="space-y-1 font-mono text-xs">
              <div>
                <span className="text-gray-500">input encoded:</span>{' '}
                <span data-testid="encoding-encoded" className="text-gray-900 dark:text-gray-100">
                  {safeEncode(state.input)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">input decoded:</span>{' '}
                <span data-testid="encoding-decoded" className="text-gray-900 dark:text-gray-100">
                  {safeDecode(state.input)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4" data-testid="query-params">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Query parameters (
                {isQueryMode ? state.currentParams.length : components.params.length})
              </h4>
              {isQueryMode ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        currentParams: [
                          ...state.currentParams,
                          {
                            key: '',
                            value: '',
                            id: `p${state.paramSeed + 1}-${Date.now().toString(36)}`,
                          },
                        ],
                        paramSeed: state.paramSeed + 1,
                      })
                    }
                    data-testid="btn-add-param"
                    className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Add param
                  </button>
                  <CopyButton
                    value={JSON.stringify(
                      Object.fromEntries(state.currentParams.map((p) => [p.key, p.value])),
                      null,
                      2
                    )}
                    testid="btn-copy-json-inline"
                  />
                </div>
              ) : null}
            </div>
            {components.params.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No query parameters.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {components.params.map((param: QueryParam, index: number) => (
                  <li
                    key={param.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2 dark:border-gray-800"
                    data-testid={`param-row-${index}`}
                  >
                    <span className="text-gray-400">#{index + 1}</span>
                    {isQueryMode ? (
                      <>
                        <input
                          type="text"
                          value={param.key}
                          onChange={(e) =>
                            update({
                              currentParams: state.currentParams.map((p) =>
                                p.id === param.id ? { ...p, key: e.target.value } : p
                              ),
                            })
                          }
                          data-testid={`param-key-${index}`}
                          aria-label={`Parameter ${index + 1} key`}
                          className="w-32 rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800"
                        />
                        <input
                          type="text"
                          value={param.value}
                          onChange={(e) =>
                            update({
                              currentParams: state.currentParams.map((p) =>
                                p.id === param.id ? { ...p, value: e.target.value } : p
                              ),
                            })
                          }
                          data-testid={`param-value-${index}`}
                          aria-label={`Parameter ${index + 1} value`}
                          className="w-40 rounded border border-gray-300 px-2 py-1 font-mono dark:border-gray-700 dark:bg-gray-800"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            update({
                              currentParams: state.currentParams.filter((p) => p.id !== param.id),
                            })
                          }
                          data-testid={`param-remove-${index}`}
                          aria-label={`Remove parameter ${index + 1}`}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...state.currentParams];
                            const idx = list.findIndex((p) => p.id === param.id);
                            if (idx > 0) {
                              const item = list[idx];
                              if (item) {
                                list.splice(idx, 1);
                                list.splice(idx - 1, 0, item);
                                update({ currentParams: list });
                              }
                            }
                          }}
                          data-testid={`param-move-up-${index}`}
                          aria-label={`Move parameter ${index + 1} up`}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...state.currentParams];
                            const idx = list.findIndex((p) => p.id === param.id);
                            if (idx >= 0 && idx < list.length - 1) {
                              const item = list[idx];
                              if (item) {
                                list.splice(idx, 1);
                                list.splice(idx + 1, 0, item);
                                update({ currentParams: list });
                              }
                            }
                          }}
                          data-testid={`param-move-down-${index}`}
                          aria-label={`Move parameter ${index + 1} down`}
                          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                        >
                          ↓
                        </button>
                      </>
                    ) : (
                      <span className="font-mono">
                        <span
                          data-testid={`param-key-text-${index}`}
                          className="text-gray-900 dark:text-gray-100"
                        >
                          {param.key}
                        </span>
                        <span className="text-gray-400"> = </span>
                        <span
                          data-testid={`param-value-text-${index}`}
                          className="text-gray-900 dark:text-gray-100"
                        >
                          {param.value}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isQueryMode ? (
            <div className="mt-4" data-testid="rebuilt-url">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Rebuilt URL
              </h4>
              <p
                className="break-all font-mono text-xs text-gray-900 dark:text-gray-100"
                data-testid="rebuilt-url-text"
              >
                {rebuiltUrl}
              </p>
              <CopyButton value={rebuiltUrl} testid="btn-copy-rebuilt" />
              <button
                type="button"
                onClick={() => update({ input: rebuiltUrl, editMode: 'input', currentParams: [] })}
                data-testid="btn-apply-rebuilt"
                className="ml-2 rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Apply to input
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default Canvas;
