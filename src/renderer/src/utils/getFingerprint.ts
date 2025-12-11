import Fingerprint from '@fingerprintjs/fingerprintjs';

export const getFingerprint = async (): Promise<string> => {
  const fpPromise = Fingerprint.load();
  const fp = await fpPromise;
  return fp.get().then((result) => result.visitorId);
};

export const getFingerprintArray = async (): Promise<string[]> => [
  await getFingerprint(),
];
