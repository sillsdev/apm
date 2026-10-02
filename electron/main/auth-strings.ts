export interface AuthProcessStrings {
  abortLogin: string;
  back: string;
  exit: string;
  loginFailed: string;
  tokenExchangeFailed: string;
  tryAgain: string;
  workOffline: string;
}

const defaults: AuthProcessStrings = {
  abortLogin: 'Abort Login',
  back: 'Back',
  exit: 'Exit',
  loginFailed: 'Login failed',
  tokenExchangeFailed: 'Could not complete sign-in (token exchange failed).',
  tryAgain: 'Try again',
  workOffline: 'Work offline',
};

let strings: AuthProcessStrings = { ...defaults };

export function setAuthProcessStrings(next: Partial<AuthProcessStrings>): void {
  strings = { ...strings, ...next };
}

export function getAuthProcessStrings(): AuthProcessStrings {
  return strings;
}
