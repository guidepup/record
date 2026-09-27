import { ChildProcess, spawn } from "child_process";
import { mkdirSync, unlinkSync } from "fs";
import { EventEmitter } from "events";
import { join } from "path";
import { record } from "./record";

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

const mockDirectory = "test-directory";
const mockFilepath = join(mockDirectory, "test-filepath.ext");

const createMockProcess = () => {
  const stderr = Object.assign(new EventEmitter(), {
    setEncoding: jest.fn(),
  });

  return Object.assign(new EventEmitter(), {
    stderr,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    kill: jest.fn(() => true),
  });
};

let mockProcess: ReturnType<typeof createMockProcess>;

describe("record", () => {
  let stopRecording;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcess = createMockProcess();
    jest.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);

    stopRecording = record(mockFilepath);
  });

  it("should create the directory path", () => {
    expect(mkdirSync).toHaveBeenCalledWith(mockDirectory, { recursive: true });
  });

  it("should delete the file if already exists (because the screencapture command won't overwrite)", () => {
    expect(unlinkSync).toHaveBeenCalledWith(mockFilepath);
  });

  it("should spawn a screencapture child process for recording", () => {
    expect(spawn).toHaveBeenCalledWith(
      "/usr/sbin/screencapture",
      ["-v", "-C", "-k", "-T0", "-g", mockFilepath],
      {
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
  });

  it("should send SIGINT and wait for the process to close", async () => {
    const stopPromise = stopRecording();
    const onStopped = jest.fn();

    stopPromise.then(onStopped);

    expect(mockProcess.kill).toHaveBeenCalledWith("SIGINT");
    await Promise.resolve();
    expect(onStopped).not.toHaveBeenCalled();

    mockProcess.emit("close", 0, null);

    await expect(stopPromise).resolves.toBeUndefined();
    expect(onStopped).toHaveBeenCalled();
  });

  it("should include stderr when screencapture fails to save the file", async () => {
    const stopPromise = stopRecording();

    mockProcess.stderr.emit(
      "data",
      "screencapture: Failed to save to final location",
    );
    mockProcess.emit("close", 1, null);

    await expect(stopPromise).rejects.toThrow(
      "screencapture: Failed to save to final location",
    );
  });

  it("should reject if screencapture fails to spawn", async () => {
    const stopPromise = stopRecording();
    const spawnError = new Error("unable to spawn screencapture");

    mockProcess.emit("error", spawnError);

    await expect(stopPromise).rejects.toBe(spawnError);
  });
});
