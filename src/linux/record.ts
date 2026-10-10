import { record as recordWithCommand } from "../common/record";

/**
 * [API Reference](https://www.guidepup.dev/docs/api/class-linux-record)
 *
 * Start a screen recording on Linux using an X11 display.
 *
 * @param {string} filepath The file path to save the recording to.
 * @returns {Function} An async function to stop and finalize the recording.
 */
export function record(filepath: string): () => Promise<void> {
  const display = process.env.DISPLAY;

  if (!display) {
    throw new Error(
      "Linux recording requires an X11 display; the DISPLAY environment variable is not set.",
    );
  }

  return recordWithCommand(filepath, [
    "-f",
    "x11grab",
    "-framerate",
    "60",
    "-i",
    display,
    "-pix_fmt",
    "yuv420p",
    "-vcodec",
    "mpeg4",
    filepath,
  ]);
}
