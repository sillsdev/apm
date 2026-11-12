const isElectron = window?.api !== undefined;

export const appPath = (): string => (isElectron ? '.' : '');
//export const appPath = (): string => '';

export default appPath;
