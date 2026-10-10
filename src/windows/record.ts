import { record as recordWithCommand } from "../common/record";

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
  return recordWithCommand(
    filepath,
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
  );
}
