import { mkdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import { spawn } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require("ffmpeg-static");

/**
 * [API Reference](https://www.guidepup.dev/docs/api/class-windows-record)
 *
 * Start a screen recording on Windows.
 *
 * ```ts
 * import { windowsRecord } from "@guidepup/record";
 *
 * (async () => {
 *   // Start the screen recording.
 *   const stopRecording = windowsRecord("./recordings/screenRecording.mp4");
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
    ffmpegPath,
    [
      "-f",
      "gdigrab",
      "-framerate",
      "60",
      "-i",
      "desktop",
      "-pix_fmt",
      "yuv420p",
      "-vcodec",
      "mpeg4",
      filepath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
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
    if (stopPromise) {
      return stopPromise;
    }

    if (
      !spawnError &&
      screencapture.exitCode === null &&
      screencapture.signalCode === null
    ) {
      screencapture.stdin.end("q");
    }

    stopPromise = captureResult.then((result) => {
      if ("error" in result) {
        throw result.error;
      }

      if (result.code === 0) {
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
    });

    return stopPromise;
  };
}
