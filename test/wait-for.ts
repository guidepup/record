import { delay } from "./delay";

export const waitFor = async (assertion: () => void, timeout = 10000) => {
  const deadline = Date.now() + timeout;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      assertion();

      return;
    } catch (error) {
      lastError = error;

      await delay(100);
    }
  }

  throw lastError;
};
