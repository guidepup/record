import { existsSync, mkdtempSync, rmSync, statSync } from "fs";
import { delay } from "../test/delay";
import { join } from "node:path";
import { linuxRecord } from "./index";
import { tmpdir } from "node:os";
import { waitFor } from "../test/wait-for";

describe("Linux recording integration", () => {
  it("creates a non-empty recording file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "guidepup-record-linux-"));
    const filepath = join(directory, "recordings", "recording.mp4");
    let stopRecording: (() => Promise<void>) | undefined;

    try {
      stopRecording = linuxRecord(filepath);
      await delay(500);
      await stopRecording();
      stopRecording = undefined;

      await waitFor(() => {
        expect(existsSync(filepath)).toBe(true);
        expect(statSync(filepath).isFile()).toBe(true);
        expect(statSync(filepath).size).toBeGreaterThan(0);
      });
    } finally {
      try {
        await stopRecording?.();

        rmSync(directory, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 100,
        });
      } catch {
        // Swallow
      }
    }
  }, 30000);
});
