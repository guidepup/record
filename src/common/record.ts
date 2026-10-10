import { mkdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import { spawn } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require("ffmpeg-static");

const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 20_000;
const SIGNAL_SHUTDOWN_TIMEOUT_MS = 5_000;
const FORCED_SHUTDOWN_TIMEOUT_MS = 5_000;
const TERMINATION_STAGES: {
  signal: NodeJS.Signals;
  timeoutMs: number;
}[] = [
  { signal: "SIGTERM", timeoutMs: SIGNAL_SHUTDOWN_TIMEOUT_MS },
  { signal: "SIGKILL", timeoutMs: FORCED_SHUTDOWN_TIMEOUT_MS },
];

export function record(
  filepath: string,
  ffmpegArguments: string[],
): () => Promise<void> {
  mkdirSync(dirname(filepath), { recursive: true });

  try {
    unlinkSync(filepath);
  } catch {
    // file doesn't exist.
  }

  const ffmpeg = spawn(ffmpegPath, ffmpegArguments, {
    stdio: ["pipe", "ignore", "pipe"],
  });

  let stderr = "";
  let spawnError: Error | undefined;

  const captureResult = new Promise<
    { error: Error } | { code: number | null; signal: NodeJS.Signals | null }
  >((resolve) => {
    ffmpeg.once("error", (error) => {
      spawnError = error;
      resolve({ error });
    });

    ffmpeg.once("close", (code, signal) => {
      if (!spawnError) {
        resolve({ code, signal });
      }
    });
  });

  ffmpeg.stderr.setEncoding("utf8");

  ffmpeg.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let stopPromise: Promise<void> | undefined;

  const waitForCaptureResult = async (
    timeoutMs: number,
  ): Promise<
    | { error: Error }
    | { code: number | null; signal: NodeJS.Signals | null }
    | undefined
  > => {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutResult = new Promise<undefined>((resolve) => {
      timeout = setTimeout(() => resolve(undefined), timeoutMs);
    });
    const result = await Promise.race([captureResult, timeoutResult]);

    if (timeout) {
      clearTimeout(timeout);
    }

    return result;
  };

  const isRunning = () =>
    !spawnError && ffmpeg.exitCode === null && ffmpeg.signalCode === null;

  const sendSignal = (signal: NodeJS.Signals) => {
    try {
      ffmpeg.kill(signal);
    } catch (error) {
      throw new Error(
        `Unable to send ${signal} to ffmpeg recording: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const getTimeoutError = (message: string) => {
    const errorOutput = stderr.trim();
    return new Error(`${message}${errorOutput ? `: ${errorOutput}` : ""}`);
  };

  return () => {
    if (!stopPromise) {
      stopPromise = (async () => {
        let lastSignal: NodeJS.Signals | undefined;

        if (isRunning()) {
          ffmpeg.stdin.end("q");
        }

        let result = await waitForCaptureResult(GRACEFUL_SHUTDOWN_TIMEOUT_MS);

        for (const stage of TERMINATION_STAGES) {
          if (result || !isRunning()) {
            break;
          }

          sendSignal(stage.signal);
          lastSignal = stage.signal;
          result = await waitForCaptureResult(stage.timeoutMs);
        }

        if (!result && !isRunning()) {
          result = await waitForCaptureResult(FORCED_SHUTDOWN_TIMEOUT_MS);
        }

        if (!result) {
          throw getTimeoutError(
            lastSignal === "SIGKILL"
              ? `ffmpeg recording did not close after SIGKILL within ${FORCED_SHUTDOWN_TIMEOUT_MS}ms`
              : lastSignal === "SIGTERM"
                ? `ffmpeg recording did not close after SIGTERM within ${SIGNAL_SHUTDOWN_TIMEOUT_MS}ms`
                : `ffmpeg recording exited but did not emit close within ${FORCED_SHUTDOWN_TIMEOUT_MS}ms`,
          );
        }

        if ("error" in result) {
          throw result.error;
        }

        if (
          result.code === 0 ||
          result.signal === "SIGINT" ||
          (lastSignal !== undefined && result.signal === lastSignal)
        ) {
          return;
        }

        const exitDetails = result.signal
          ? `signal ${result.signal}`
          : `exit code ${result.code}`;

        const errorOutput = stderr.trim();

        throw new Error(
          `ffmpeg recording failed (${exitDetails})${
            errorOutput ? `: ${errorOutput}` : ""
          }`,
        );
      })();
    }

    return stopPromise;
  };
}
