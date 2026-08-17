import Fingerprint from '@fingerprintjs/fingerprintjs';

let fingerprintPromise: Promise<string> | null = null;

export const getFingerprint = async (): Promise<string> => {
  if (!fingerprintPromise) {
    fingerprintPromise = (async () => {
      const fp = await Fingerprint.load();
      const result = await fp.get();
      return result.visitorId;
    })().catch((error) => {
      fingerprintPromise = null;
      throw error;
    });
  }

  return fingerprintPromise;
};

export const getFingerprintArray = async (): Promise<string[]> => [
  await getFingerprint(),
];
