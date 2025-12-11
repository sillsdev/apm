import Fingerprint from '@fingerprintjs/fingerprintjs';

export const getFingerprint = async (): Promise<string> => {
  const fpPromise = Fingerprint.load();
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
};

export const getFingerprintArray = async (): Promise<string[]> => [
  await getFingerprint(),
];
