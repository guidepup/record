import { mkdirSync, unlinkSync } from "fs";
import { dirname } from "path";
import { spawn } from "child_process";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require("ffmpeg-static");

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

  const ffmpeg = spawn(
    ffmpegPath,
    [
      "-f",
      "avfoundation",
      "-framerate",
      "60",
      "-pixel_format",
      "uyvy422",
      "-capture_cursor",
      "1",
      "-capture_mouse_clicks",
      "1",
      "-i",
      "Capture screen 0:default",
      "-pix_fmt",
      "yuv420p",
      "-vcodec",
      "mpeg4",
      filepath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );

  let stderr = "";

  ffmpeg.stderr.setEncoding("utf8");

  ffmpeg.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

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

  let stopPromise: Promise<void> | undefined;

  return () => {
    if (!stopPromise) {
      const shouldSignal =
        !spawnError && ffmpeg.exitCode === null && ffmpeg.signalCode === null;

      if (shouldSignal) {
        ffmpeg.stdin.end("q");
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
          `ffmpeg recording failed (${exitDetails})${
            errorOutput ? `: ${errorOutput}` : ""
          }`,
        );
      });
    }

    return stopPromise;
  };
}
