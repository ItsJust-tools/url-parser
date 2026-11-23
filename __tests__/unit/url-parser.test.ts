import { describe, it, expect } from 'vitest';
import {
  parseUrl,
  defaultPortFor,
  urlError,
  buildUrl,
  safeDecode,
  safeEncode,
  encodingBreakdown,
  historyText,
} from '@/tool/types';
import {
  serializeState,
  deserializeState,
  withHistory,
  roundTrips,
  editParam,
  removeParam,
  addParam,
  moveParam,
} from '@/tool/tool-definition';
import { nextParamId } from '@/tool/types';
import { DEFAULT_STATE, MAX_HISTORY, type ToolState } from '@/tool/types';
import { urlParserTool } from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const FULL_URL =
  'https://user:secret@example.com:8443/path/to/page?q=hello%20world&lang=en#frag%20ment';

describe('url parsing', () => {
  it('parses full URL with auth, port, path, params and hash correctly', () => {
    const components = parseUrl(FULL_URL);
    expect(components.valid).toBe(true);
    expect(components.protocol).toBe('https');
    expect(components.username).toBe('user');
    expect(components.password).toBe('secret');
    expect(components.hostname).toBe('example.com');
    expect(components.explicitPort).toBe('8443');
    expect(components.port).toBe('8443');
    expect(components.pathSegments).toEqual(['path', 'to', 'page']);
    expect(components.params).toHaveLength(2);
    expect(components.params[0]?.key).toBe('q');
    expect(components.params[0]?.value).toBe('hello world');
    expect(components.params[1]).toEqual({
      key: 'lang',
      value: 'en',
      id: components.params[1]?.id,
    });
    expect(components.hash).toBe('frag ment');
  });

  it('applies default ports for http and https when port is missing', () => {
    const http = parseUrl('http://example.com/');
    expect(http.explicitPort).toBeNull();
    expect(http.port).toBe('80');
    const https = parseUrl('https://example.com/');
    expect(https.port).toBe('443');
    const custom = parseUrl('ftp://files.example.org/pub');
    expect(custom.protocol).toBe('ftp');
    expect(custom.port).toBe('21');
    expect(defaultPortFor('ws')).toBeNull();
    expect(defaultPortFor(null)).toBeNull();
  });

  it('parses encoded ampersands as part of param values, not separators', () => {
    const components = parseUrl('https://example.com/?a=1%26b&c=d');
    expect(components.valid).toBe(true);
    const first = components.params.find((p) => p.key === 'a');
    expect(first?.value).toBe('1&b');
    expect(components.params).toHaveLength(2);
  });

  it('handles empty query strings and bare hashes', () => {
    const noQuery = parseUrl('https://example.com/path');
    expect(noQuery.params).toEqual([]);
    const bareHash = parseUrl('https://example.com/path#');
    expect(bareHash.hash).toBe('');
    const root = parseUrl('https://example.com/');
    expect(root.pathSegments).toEqual([]);
    expect(root.valid).toBe(true);
  });

  it('returns invalid components for empty and garbage input without throwing', () => {
    expect(parseUrl('').valid).toBe(false);
    expect(parseUrl('   ').valid).toBe(false);
    // 'ht!tp' with an https prefix is technically parseable; garbage without scheme is what fails
    expect(parseUrl('not a url at all!!').valid).toBe(false);
    const none = parseUrl('');
    expect(none.protocol).toBeNull();
    expect(none.host).toBeNull();
  });

  it('accepts scheme-less input by assuming https', () => {
    const components = parseUrl('example.com/x?y=1');
    expect(components.valid).toBe(true);
    expect(components.protocol).toBe('https');
    expect(components.pathSegments).toEqual(['x']);
    expect(components.params[0]?.key).toBe('y');
  });

  it('provides clear errors via urlError', () => {
    expect(urlError('')).toContain('Enter a URL');
    expect(urlError('https://ok.example.com')).toBeNull();
    expect(urlError('http://exa mple.com')).toContain('Invalid URL');
  });

  it('decodes path segments and hash safely', () => {
    const components = parseUrl('https://example.com/a%20b/%E4%B8%AD#%E4%B8%AD');
    expect(components.pathSegments).toEqual(['a b', '中']);
    expect(components.hash).toBe('中');
  });

  it('supports percent-encoding inspection helpers', () => {
    expect(safeEncode('a b&c')).toBe('a%20b%26c');
    expect(safeDecode('a%20b%26c')).toBe('a b&c');
    expect(safeDecode('%zz')).toBe('%zz');
    const breakdown = encodingBreakdown('a b', 'host');
    expect(breakdown.map((b) => b.label)).toEqual(['host raw', 'host encoded', 'host decoded']);
    expect(breakdown[1]?.text).toBe('a%20b');
  });

  it('exposes a stable param id generator', () => {
    const a = nextParamId();
    const b = nextParamId();
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
  });

  it('generates readable history markers', () => {
    expect(historyText(FULL_URL)).toContain('https://example.com');
    expect(historyText('nonsense!!')).toContain('invalid');
  });
});

describe('query parameter editing', () => {
  const seeded = (): ToolState => ({
    ...state({
      input: 'https://example.com/?a=1&b=2',
      editMode: 'query',
      currentParams: parseUrl('https://example.com/?a=1&b=2').params,
    }),
  });

  it('seeds query editing from parsed params and rebuilds URL correctly', () => {
    const s = seeded();
    expect(s.currentParams.map((p) => p.key)).toEqual(['a', 'b']);
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?a=1&b=2');
  });

  it('adds, edits and removes query parameters rebuilding the URL correctly', () => {
    let s = seeded();
    // edit a value
    const aId = s.currentParams[0]?.id ?? '';
    s = editParam(s, aId, 'value', 'changed');
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?a=changed&b=2');
    // edit a key
    s = editParam(s, aId, 'key', 'alpha');
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?alpha=changed&b=2');
    // add a param
    s = addParam(s);
    const newId = s.currentParams[2]?.id ?? '';
    s = editParam(s, newId, 'key', 'c');
    s = editParam(s, newId, 'value', '3');
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?alpha=changed&b=2&c=3');
    // remove a param
    s = removeParam(s, aId);
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?b=2&c=3');
    expect(s.currentParams).toHaveLength(2);
  });

  it('reorders query parameters and rebuilds the URL in the new order', () => {
    let s = seeded();
    const aId = s.currentParams[0]?.id ?? '';
    s = moveParam(s, aId, 1);
    expect(s.currentParams.map((p) => p.key)).toEqual(['b', 'a']);
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/?b=2&a=1');
    // boundary moves are no-ops (after the swap, aId sits at index 0; moving up again is a no-op)
    const lastId = s.currentParams[1]?.id ?? '';
    expect(moveParam(s, lastId, 1).currentParams.map((p) => p.key)).toEqual(['b', 'a']);
  });

  it('drops params with empty keys when rebuilding and clears query string entirely', () => {
    let s = seeded();
    s = removeParam(s, s.currentParams[0]?.id ?? '');
    s = removeParam(s, s.currentParams[0]?.id ?? '');
    expect(buildUrl(s.input, s.currentParams)).toBe('https://example.com/');
    // empty-key params are skipped from the rebuilt query
    s = {
      ...s,
      currentParams: [
        { key: '', value: 'ignored', id: 'x1' },
        { key: 'ok', value: 'yes', id: 'x2' },
      ],
    };
    expect(buildUrl(s.input, s.currentParams)).toContain('ok=yes');
    expect(buildUrl(s.input, s.currentParams)).not.toContain('ignored');
  });

  it('returns the raw input when it cannot be rebuilt', () => {
    expect(buildUrl('', [])).toBe('');
    expect(buildUrl('not a url at all!!', [])).toBe('not a url at all!!');
  });
});

describe('state serialization', () => {
  it('round-trips a full state payload', () => {
    const s = state({
      input: FULL_URL,
      editMode: 'query',
      currentParams: parseUrl(FULL_URL).params,
      history: [{ text: 'Parsed https://example.com', createdAt: '2026-11-23T10:00:00.000Z' }],
    });
    expect(roundTrips(s)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.input).toBe(FULL_URL);
      expect(restored.data.currentParams.map((p) => p.key)).toEqual(['q', 'lang']);
      expect(restored.data.history).toHaveLength(1);
    }
  });

  it('rejects non-object payloads with a clear error', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    const bad = deserializeState('nope');
    if (!bad.success) {
      expect(bad.error).toContain('Invalid data format');
    } else {
      throw new Error('expected failure');
    }
  });

  it('repairs malformed fields with defaults', () => {
    const result = deserializeState({
      input: 42,
      editMode: 'bogus',
      currentParams: 'not-a-list',
      paramSeed: 'nope',
      history: [{ text: 1 }, null, { text: 'ok', createdAt: '2026-11-23T00:00:00.000Z' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toBe('');
      expect(result.data.editMode).toBe('input');
      expect(result.data.currentParams).toEqual([]);
      expect(result.data.paramSeed).toBe(0);
      expect(result.data.history).toHaveLength(1);
    }
  });

  it('caps history at MAX_HISTORY and prepends newest first', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 5; i += 1) {
      s = withHistory(s, `entry ${i}`, new Date(2026, 0, 1, 0, 0, i));
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry ${MAX_HISTORY + 4}`);
  });

  it('validates restored params and drops malformed rows', () => {
    const result = deserializeState({
      currentParams: [
        { key: 'a', value: '1', id: 'p1' },
        { key: 5, value: '2', id: 'p2' },
        { key: 'b', value: '2' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentParams).toEqual([{ key: 'a', value: '1', id: 'p1' }]);
    }
  });

  it('exposes the tool definition identity', () => {
    expect(urlParserTool.id).toBe('url-parser');
    expect(urlParserTool.initialState).toEqual(DEFAULT_STATE);
  });
});
