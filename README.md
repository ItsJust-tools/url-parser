# URL Parser

Parse any URL into protocol, host, port, path, query params and hash, with editable query string rebuilding. All client-side, privacy-first.

**Live:** [url-parser.itsjust.tools](https://url-parser.itsjust.tools)

## Features

- Parse protocol, username, hostname, port, pathname, search params and hash
- Decode and display each query parameter key and value
- Edit, add, remove and reorder query parameters and see the rebuilt URL live
- Percent-encoding inspector for each URL component
- Validate input URLs with clear error messages — invalid input never crashes state
- Copy the full URL or copy query params as JSON
- Default ports (http 80, https 443) shown even when omitted from the input
- Handles edge cases: missing ports, empty query strings, encoded ampersands
- Shareable state in the URL hash for link sharing
- 100% client-side — no data ever leaves your browser

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-url-parser .
docker run -p 3000:3000 itsjust-url-parser
```

## License

MIT
