import { existsSync, mkdtempSync, rmSync, statSync } from "fs";
import { delay } from "../test/delay";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { waitFor } from "../test/wait-for";
import { windowsRecord } from "./index";

describe("Windows recording integration", () => {
  it("creates a non-empty recording file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "guidepup-record-windows-"));
    const filepath = join(directory, "recordings", "recording.mp4");
    let stopRecording: (() => void) | undefined;

    try {
      stopRecording = windowsRecord(filepath);
      await delay(500);
      stopRecording();
      stopRecording = undefined;

      await waitFor(() => {
        expect(existsSync(filepath)).toBe(true);
        expect(statSync(filepath).isFile()).toBe(true);
        expect(statSync(filepath).size).toBeGreaterThan(0);
      });
    } finally {
      try {
        stopRecording?.();

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
