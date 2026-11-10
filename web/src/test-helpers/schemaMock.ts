/** Schema mock whose memory getter runs after the test's const is initialized. */
export const schemaMock = (getMemory: () => object) => ({
  get memory() {
    return getMemory();
  },
  requestedSchema: 100,
});
