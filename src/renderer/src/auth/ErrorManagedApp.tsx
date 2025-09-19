import React, { useEffect } from 'react';
import { isElectron } from '../../api-variable';
import { logFile, LocalKey } from '../utils';
import ErrorBoundary from '../hoc/ErrorBoundary';
import App from '../App';
import { memory } from '../schema';
import { ErrorFallback } from '../components/ErrorFallback';
import Bugsnag from '@bugsnag/js';
import { API_CONFIG } from '../../api-variable';
import bugsnagClient from './bugsnagClient';

const prodOrQa = API_CONFIG.snagId !== '';

const SnagBoundary = prodOrQa
  ? Bugsnag.getPlugin('react')?.createErrorBoundary(React)
  : null;

const ErrorManagedApp: React.FC = () => {
  const [electronLog, setElectronLog] = React.useState('errorReporter');

  useEffect(() => {
    if (isElectron) {
      logFile().then((fullName: string) => {
        localStorage.setItem(LocalKey.errorLog, fullName);
        setElectronLog(fullName);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return bugsnagClient && SnagBoundary ? (
    <SnagBoundary FallbackComponent={ErrorFallback}>
      <ErrorBoundary errorReporter={bugsnagClient} memory={memory}>
        <App />
      </ErrorBoundary>
    </SnagBoundary>
  ) : (
    <ErrorBoundary errorReporter={electronLog} memory={memory}>
      <App />
    </ErrorBoundary>
  );
};

export default ErrorManagedApp;
