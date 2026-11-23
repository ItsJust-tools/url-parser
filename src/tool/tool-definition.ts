import type { DeserializeResult, Tool } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  historyText,
  nextParamId,
  parseUrl,
  summaryText,
  urlError,
  safeDecode,
  safeEncode,
  buildUrl,
  defaultPortFor,
  encodingBreakdown,
  emptyComponents,
  type HistoryEntry,
  type QueryParam,
  type ToolState,
  type UrlComponents,
  type EditMode,
  type ParamField,
} from './types';

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    input: state.input,
    editMode: state.editMode,
    currentParams: state.currentParams,
    paramSeed: state.paramSeed,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validParams(value: unknown): QueryParam[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is QueryParam =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as QueryParam).key === 'string' &&
        typeof (entry as QueryParam).value === 'string' &&
        typeof (entry as QueryParam).id === 'string'
    )
    .map((entry) => ({ ...entry }));
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected URL parser state object',
    };
  }
  const v = data as Record<string, unknown>;
  const editMode = v.editMode === 'query' ? 'query' : 'input';
  const state: ToolState = {
    input: stringOr(v.input, DEFAULT_STATE.input),
    editMode,
    currentParams: validParams(v.currentParams),
    paramSeed: typeof v.paramSeed === 'number' && Number.isFinite(v.paramSeed) ? v.paramSeed : 0,
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** Apply a key or value edit to a parameter row. */
export function editParam(
  state: ToolState,
  id: string,
  field: ParamField,
  value: string
): ToolState {
  return {
    ...state,
    currentParams: state.currentParams.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
  };
}

/** Remove a parameter row by id. */
export function removeParam(state: ToolState, id: string): ToolState {
  return { ...state, currentParams: state.currentParams.filter((p) => p.id !== id) };
}

/** Append a blank parameter row. */
export function addParam(state: ToolState): ToolState {
  return {
    ...state,
    currentParams: [...state.currentParams, { key: '', value: '', id: nextParamId() }],
  };
}

/** Move a parameter row one position up or down. */
export function moveParam(state: ToolState, id: string, direction: -1 | 1): ToolState {
  const index = state.currentParams.findIndex((p) => p.id === id);
  if (index < 0) return state;
  const target = index + direction;
  if (target < 0 || target >= state.currentParams.length) return state;
  const list = [...state.currentParams];
  const item = list[index];
  if (!item) return state;
  list.splice(index, 1);
  list.splice(target, 0, item);
  return { ...state, currentParams: list };
}

export {
  parseUrl,
  urlError,
  buildUrl,
  defaultPortFor,
  encodingBreakdown,
  safeDecode,
  safeEncode,
  emptyComponents,
  summaryText,
  historyText,
  nextParamId,
} from './types';
export type { UrlComponents, EditMode, ParamField } from './types';

export const urlParserTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
};

export default urlParserTool;
