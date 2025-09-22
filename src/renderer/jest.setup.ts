import '@testing-library/jest-dom';

import { configure } from '@testing-library/react';

configure({ testIdAttribute: 'data-testid' });

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
