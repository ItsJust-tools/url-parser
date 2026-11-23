export interface QueryParam {
  /** Parameter key (decoded). */
  key: string;
  /** Parameter value (decoded). */
  value: string;
  /** Stable id used for list rendering and edits. */
  id: string;
}

export interface UrlComponents {
  /** Protocol scheme without trailing colon, or null for relative-like input. */
  protocol: string | null;
  /** Full host including port if present, or null. */
  host: string | null;
  /** Hostname without port, or null. */
  hostname: string | null;
  /** Explicit port from the URL, or the protocol default. */
  port: string | null;
  /** Port exactly as written; null when absent. */
  explicitPort: string | null;
  /** Percent-decoded username, or null. */
  username: string | null;
  /** Percent-decoded password, or null. */
  password: string | null;
  /** Decoded path segments, or null. Root path is an empty array. */
  pathSegments: string[] | null;
  /** Decoded query parameters in order. */
  params: QueryParam[];
  /** Decoded hash without the leading '#', or null when absent. Empty string = bare '#'. */
  hash: string | null;
  /** True when the URL parsed successfully. */
  valid: boolean;
}

export type EditMode = 'input' | 'query';

export type ParamField = 'key' | 'value';

export interface ToolState {
  /** Raw URL text currently being edited. */
  input: string;
  /** Which editor is active. */
  editMode: EditMode;
  /** Query parameters, listed in URL order. Edits apply to currentParams below. */
  currentParams: QueryParam[];
  /** Seed for stable parameter ids. */
  paramSeed: number;
  /** Saved parse snapshots, newest first. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  text: string;
  createdAt: string;
}

let idCounter = 0;
/** Generate a unique id for a query parameter row. */
export function nextParamId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}-${idCounter}`;
}

export const DEFAULT_INPUT = '';

export const DEFAULT_STATE: ToolState = {
  input: DEFAULT_INPUT,
  editMode: 'input',
  currentParams: [],
  paramSeed: 0,
  history: [],
};

export const MAX_HISTORY = 20;

const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443', ftp: '21' };

/** Port that applies for a scheme when none is written explicitly. */
export function defaultPortFor(protocol: string | null): string | null {
  if (!protocol) return null;
  return DEFAULT_PORTS[protocol.toLowerCase()] ?? null;
}

/** Percent-encoding inspector for a component string. */
export function encodingBreakdown(value: string, label: string): { label: string; text: string }[] {
  return [
    { label: `${label} raw`, text: value },
    { label: `${label} encoded`, text: safeEncode(value) },
    { label: `${label} decoded`, text: safeDecode(value) },
  ];
}

/** Percent-decode without throwing on malformed sequences. */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Percent-encode as a full URI component without throwing. */
export function safeEncode(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return value;
  }
}

const PLACEHOLDER_COMPONENTS: UrlComponents = {
  protocol: null,
  host: null,
  hostname: null,
  port: null,
  explicitPort: null,
  username: null,
  password: null,
  pathSegments: null,
  params: [],
  hash: null,
  valid: false,
};

/** Components for empty input — shape-complete, marked invalid. */
export function emptyComponents(): UrlComponents {
  return { ...PLACEHOLDER_COMPONENTS };
}

interface ParseOptions {
  /** Overrides for the stored query params (used when editMode === 'query'). */
  params?: QueryParam[];
}

/** Map a WHATWG-URL query string plus optional param overrides into QueryParam[]. */
function paramsFromSearch(search: string, overrides?: QueryParam[]): QueryParam[] {
  if (overrides) return overrides;
  if (!search) return [];
  return search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part.length > 0)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
      const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
      return { key: safeDecode(rawKey), value: safeDecode(rawValue), id: nextParamId() };
    });
}

/**
 * Parse arbitrary URL text into components. Never throws — invalid input yields
 * components.valid = false so the UI can show a clear error without crashing.
 */
export function parseUrl(input: string, options?: ParseOptions): UrlComponents {
  const raw = input.trim();
  if (!raw) return { ...emptyComponents(), params: options?.params ? options.params : [] };

  // Accept scheme-less input by testing with an https:// prefix.
  let url: URL;
  const hadScheme =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
  try {
    url = new URL(raw);
  } catch {
    if (!hadScheme) {
      try {
        url = new URL(`https://${raw}`);
      } catch {
        return { ...emptyComponents(), params: options?.params ? options.params : [] };
      }
    } else {
      return { ...emptyComponents(), params: options?.params ? options.params : [] };
    }
  }

  const explicitPort = url.port ? url.port : null;
  const port = explicitPort ?? defaultPortFor(url.protocol.replace(':', ''));
  // WHATWG parsing is lenient about malformed hostnames (e.g. 'https://nonsense!!').
  // Treat any hostname containing characters outside a valid host charset as invalid.
  if (!/^[a-zA-Z0-9.\-]+(\[[0-9a-fA-F:]+\])?$/.test(url.hostname)) {
    return { ...emptyComponents(), params: options?.params ? options.params : [] };
  }
  const pathSegments =
    url.pathname === '/'
      ? []
      : url.pathname
          .split('/')
          .filter((seg) => seg !== '')
          .map((seg) => safeDecode(seg));
  const hash = url.hash === '' ? null : safeDecode(url.hash.slice(1));

  // WHATWG URLs treat 'path#' as a bare hash fragment: '' is a present, empty hash.
  const hadExplicitHash = /#/.test(raw);
  const hashValue = hadExplicitHash
    ? safeDecode(raw.slice(raw.indexOf('#') + 1))
    : hash === ''
      ? ''
      : hash;

  return {
    protocol: url.protocol.replace(':', ''),
    host: url.host,
    hostname: url.hostname,
    port,
    explicitPort,
    username: url.username ? safeDecode(url.username) : null,
    password: url.password ? safeDecode(url.password) : null,
    pathSegments,
    params: paramsFromSearch(url.search, options?.params),
    hash: hashValue,
    valid: true,
  };
}

/** A concise one-line error for invalid URL input. */
export function urlError(input: string): string | null {
  const raw = input.trim();
  if (!raw) return 'Enter a URL to parse.';
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  try {
    new URL(candidate);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL';
    return `Invalid URL: ${message}`;
  }
  const hostname = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`).hostname;
  if (!/^[a-zA-Z0-9.\-]+(\[[0-9a-fA-F:]+\])?$/.test(hostname)) {
    return `Invalid URL: hostname contains unsupported characters`;
  }
  return null;
}

/** Rebuild the full URL from stored state, applying current params. */
export function buildUrl(input: string, params: QueryParam[]): string {
  const raw = input.trim();
  if (!raw) return '';
  const parsed = parseUrl(raw);
  if (!parsed.valid) return raw;
  try {
    const url = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`);
    const search = params
      .filter((p) => p.key !== '')
      .map((p) => `${safeEncode(p.key)}=${safeEncode(p.value)}`)
      .join('&');
    url.search = search ? `?${search}` : '';
    return url.toString();
  } catch {
    return raw;
  }
}

/** Copyable plain-text summary of the components. */
export function summaryText(input: string, params: QueryParam[]): string {
  if (params.length > 0) {
    return `URL Parser\n${buildUrl(input, params)}\nQuery params: ${JSON.stringify(
      Object.fromEntries(params.map((p) => [p.key, p.value])),
      null,
      2
    )}`;
  }
  return `URL Parser\n${buildUrl(input, params)}`;
}

/** Human readable history marker for a parsed URL. */
export function historyText(input: string): string {
  const components = parseUrl(input);
  if (!components.valid) return `URL Parser: invalid input`;
  return `URL Parser: ${components.protocol ?? ''}://${components.host ?? ''}${
    components.pathSegments && components.pathSegments.length > 0
      ? '/' + components.pathSegments.join('/')
      : ''
  }`;
}
