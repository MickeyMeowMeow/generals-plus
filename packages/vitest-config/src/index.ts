export const sharedConfig = {
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
};

export const webConfig = {
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: "jsdom",
  },
};
