import { TokenProvider } from '../context/TokenProvider';
import ErrorManagedApp from './ErrorManagedApp';

import React from 'react';

export const TokenChecked: React.FC = () => (
  <TokenProvider>
    <ErrorManagedApp />
  </TokenProvider>
);

export default TokenChecked;
