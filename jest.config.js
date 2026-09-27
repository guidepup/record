module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["src"],
  testPathIgnorePatterns: [
    "<rootDir>/src/index\\.(macos|windows)\\.int\\.test\\.ts$",
  ],
  collectCoverageFrom: ["**/*.ts"],
  coveragePathIgnorePatterns: ["<rootDir>/src/index.ts", "\\.test\\.ts$"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
