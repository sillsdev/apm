const isElectron = import.meta.env.VITE_MODE === 'electron';

export const appPath = (): string => (isElectron ? '.' : '');

export default appPath;
