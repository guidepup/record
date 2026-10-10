import { record as recordWithCommand } from "../common/record";

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
  return recordWithCommand(
    filepath,
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
  );
}
