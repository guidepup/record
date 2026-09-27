import { mkdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import { spawn } from "child_process";

// TODO: add better handling for when permissions for screen recording haven't
// been provided so that the system permissions popup is avoided.

/**
 * [API Reference](https://www.guidepup.dev/docs/api/class-macos-record)
 *
 * Start a screen recording on MacOS.
 *
 * ```ts
 * import { macOSRecord } from "@guidepup/record";
 *
 * (async () => {
 *   // Start the screen recording.
 *   const stopRecording = macOSRecord("./recordings/screenRecording.mov");
 *
 *   // ... perform some commands.
 *
 *   // Stop the screen recording.
 *   await stopRecording();
 * })();
 * ```
 *
 * @param {string} filepath The file path to save the screen recording to.
 * @returns {Function} An async function to stop and finalize the screen recording.
 */
export function record(filepath: string): () => Promise<void> {
  mkdirSync(dirname(filepath), { recursive: true });

  try {
    unlinkSync(filepath);
  } catch {
    // file doesn't exist.
  }

  const screencapture = spawn(
    "/usr/sbin/screencapture",
    ["-v", "-C", "-k", "-T0", "-g", filepath],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  let stderr = "";

  screencapture.stderr.setEncoding("utf8");

  screencapture.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let spawnError: Error | undefined;

  const captureResult = new Promise<
    { error: Error } | { code: number | null; signal: NodeJS.Signals | null }
  >((resolve) => {
    screencapture.once("error", (error) => {
      spawnError = error;
      resolve({ error });
    });

    screencapture.once("close", (code, signal) => {
      if (!spawnError) {
        resolve({ code, signal });
      }
    });
  });

  let stopPromise: Promise<void> | undefined;

  return () => {
    if (!stopPromise) {
      const shouldSignal =
        !spawnError &&
        screencapture.exitCode === null &&
        screencapture.signalCode === null;

      if (shouldSignal) {
        screencapture.kill("SIGINT");
      }

      stopPromise = captureResult.then((result) => {
        if ("error" in result) {
          throw result.error;
        }

        if (result.code === 0 || result.signal === "SIGINT") {
          return;
        }

        const exitDetails = result.signal
          ? `signal ${result.signal}`
          : `exit code ${result.code}`;

        const errorOutput = stderr.trim();

        throw new Error(
          `screencapture failed (${exitDetails})${
            errorOutput ? `: ${errorOutput}` : ""
          }`,
        );
      });
    }

    return stopPromise;
  };
}
