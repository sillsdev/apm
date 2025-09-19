import Fingerprint2 from 'fingerprintjs2';

export const getFingerprint = async (): Promise<string> => {
  const components = await Fingerprint2.getPromise({});
  return Fingerprint2.x64hash128(components.map((c) => c.value).join(''), 31);
};

export const getFingerprintArray = async (): Promise<string[]> => [
  await getFingerprint(),
];
