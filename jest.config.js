module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["src"],
  collectCoverageFrom: ["**/*.ts"],
  coveragePathIgnorePatterns: ["<rootDir>/src/index.ts"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
