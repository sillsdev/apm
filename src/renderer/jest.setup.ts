import '@testing-library/jest-dom';

import { configure } from '@testing-library/react';

configure({
  testIdAttribute: 'data-testid',
  // Configure React Testing Library to use React's act by default
  asyncUtilTimeout: 1000,
});

// Configure React's act environment
import { act } from 'react';

// Make act available globally for testing
(global as any).act = act;

// Mock import.meta.env for Vite environment variables
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_AKUO: 'test-akuo',
        VITE_CHM_HELP: 'test-chm-help',
        VITE_COMMUNITY: 'test-community',
        VITE_COURSE: 'test-course',
        VITE_ENDPOINT: 'test-endpoint',
        VITE_FLAT: 'test-flat',
        VITE_GEN_FLAT: 'test-gen-flat',
        VITE_GEN_HIERARCHICAL: 'test-gen-hierarchical',
        VITE_GOOGLE_SAMPLES: 'test-google-samples',
        VITE_HIERARCHICAL: 'test-hierarchical',
        VITE_HELP: 'test-help',
        VITE_DESKTOP_HELP: 'test-desktop-help',
        VITE_HOST: 'test-host',
        VITE_NOTIFY: 'https://test-notify.bugsnag.com',
        VITE_OFFLINE: 'true',
        VITE_OFFLINE_DATA: 'test-transcriber',
        VITE_OPENCONTENT: 'test-opencontent',
        VITE_OPENNOTES: 'test-opennotes',
        VITE_SITE_TITLE: 'Test Audio Project Manager',
        VITE_RESOURCES: 'test-resources',
        VITE_SCHEMAVERSION: '100',
        VITE_SESSIONS: 'https://test-sessions.bugsnag.com',
        VITE_SIZELIMIT: '20',
        VITE_SNAGID: 'test-snag-id',
        VITE_VIDEO_TRAINING: 'test-video-training',
        VITE_WALK_THRU: 'test-walk-thru',
        VITE_DEBUG: 'false',
        VITE_MODE: 'test',
        VITE_CALLBACK: 'http://localhost:3000/callback',
        NODE_ENV: 'test',
      },
    },
  },
  writable: true,
});

// Suppress act warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes(
        'Warning: The current testing environment is not configured to support act'
      ) ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('Warning: `ReactDOMTestUtils.act` is deprecated'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Polyfill Blob.arrayBuffer for older jsdom versions
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}
