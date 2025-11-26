// put CT-only commands here

// CRITICAL: Set up process.env FIRST, before any other imports
// Some modules access process.env at module load time
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {
      NODE_ENV: 'test',
      FA_VERSION: 'test-version',
    },
  };
} else {
  // Ensure process.env exists even if process does
  if (!process.env) {
    process.env = {};
  }
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.FA_VERSION = process.env.FA_VERSION || 'test-version';
}

// Also set it on globalThis to ensure it's available everywhere
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).process) {
    (globalThis as any).process = {
      env: {
        NODE_ENV: 'test',
        FA_VERSION: 'test-version',
      },
    };
  } else if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {
      NODE_ENV: 'test',
      FA_VERSION: 'test-version',
    };
  }
}

import './commands';

import { mount } from 'cypress/react';

Cypress.Commands.add('mount', mount);

// Set up import.meta.env for Vite environment variables
try {
  if (typeof import.meta !== 'undefined') {
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_AKUO: '',
        VITE_CHM_HELP: '',
        VITE_COMMUNITY: '',
        VITE_COURSE: '',
        VITE_ENDPOINT: '',
        VITE_FLAT: '',
        VITE_GEN_FLAT: '',
        VITE_GEN_HIERARCHICAL: '',
        VITE_GOOGLE_SAMPLES: '',
        VITE_HIERARCHICAL: '',
        VITE_HELP: '',
        VITE_DESKTOP_HELP: '',
        VITE_HOST: '',
        VITE_NOTIFY: 'https://notify.bugsnag.com',
        VITE_OFFLINE: 'true',
        VITE_OFFLINE_DATA: 'transcriber',
        VITE_OPENCONTENT: '',
        VITE_OPENNOTES: '',
        VITE_SITE_TITLE: 'Audio Project Manager',
        VITE_RESOURCES: '',
        VITE_SCHEMAVERSION: '100',
        VITE_SESSIONS: 'https://sessions.bugsnag.com',
        VITE_SIZELIMIT: '20',
        VITE_SNAGID: '',
        VITE_VIDEO_TRAINING: '',
        VITE_WALK_THRU: '',
        VITE_DEBUG: 'false',
        VITE_MODE: 'test',
        VITE_CALLBACK: 'http://localhost:3000/callback',
        NODE_ENV: 'test',
      },
      writable: true,
    });
  }
} catch {
  // import.meta may not be available in all contexts
  // This is fine, the code will handle it
}
