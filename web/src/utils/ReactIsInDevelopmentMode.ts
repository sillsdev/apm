import React from 'react';

export function ReactIsInDevelomentMode(): boolean {
  return '_self' in React.createElement('div');
}
