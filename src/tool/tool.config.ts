import type { ToolConfig } from '@itsjust/core';

export const toolConfig: ToolConfig = {
  id: 'url-parser',
  name: 'URL Parser',
  description:
    'Parse any URL into protocol, host, port, path, query params and hash with editable query string rebuilding.',
  version: '1.0.0',
  exportFormats: ['json'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.08)',
    brand: 'URL Parser',
    icon: '🔗',
  },
};

export default toolConfig;
