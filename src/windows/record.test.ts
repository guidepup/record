import { ChildProcess, spawn } from "child_process";
import { mkdirSync, unlinkSync } from "fs";
import { EventEmitter } from "events";
import { join } from "path";
import { record } from "./record";

jest.mock("ffmpeg-static", () => "test-ffmpeg");
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
  const stdin = Object.assign(new EventEmitter(), {
    end: jest.fn(),
  });
  const stderr = Object.assign(new EventEmitter(), {
    setEncoding: jest.fn(),
  });

  return Object.assign(new EventEmitter(), {
    stdin,
    stderr,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
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

  it("should delete the file if already exists (to eliminate dealing with overwrite options)", () => {
    expect(unlinkSync).toHaveBeenCalledWith(mockFilepath);
  });

  it("should spawn an ffmpeg child process for recording", () => {
    expect(spawn).toHaveBeenCalledWith(
      "test-ffmpeg",
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
        mockFilepath,
      ],
      {
        stdio: ["pipe", "ignore", "pipe"],
      },
    );
  });

  it("should send q and wait for the process to close", async () => {
    const stopPromise = stopRecording();
    const onStopped = jest.fn();

    stopPromise.then(onStopped);

    expect(mockProcess.stdin.end).toHaveBeenCalledWith("q");
    await Promise.resolve();
    expect(onStopped).not.toHaveBeenCalled();

    mockProcess.emit("close", 0, null);

    await expect(stopPromise).resolves.toBeUndefined();
    expect(onStopped).toHaveBeenCalled();
  });

  it("should reuse the stop promise when called more than once", async () => {
    const firstStop = stopRecording();
    const secondStop = stopRecording();

    expect(secondStop).toBe(firstStop);
    expect(mockProcess.stdin.end).toHaveBeenCalledTimes(1);

    mockProcess.emit("close", 0, null);

    await expect(firstStop).resolves.toBeUndefined();
  });

  it("should not write to stdin after ffmpeg has exited", async () => {
    mockProcess.exitCode = 0;

    const stopPromise = stopRecording();

    expect(mockProcess.stdin.end).not.toHaveBeenCalled();

    mockProcess.emit("close", 0, null);

    await expect(stopPromise).resolves.toBeUndefined();
  });

  it("should include stderr when ffmpeg fails", async () => {
    const stopPromise = stopRecording();

    mockProcess.stderr.emit("data", "ffmpeg: capture failed");
    mockProcess.emit("close", 1, null);

    await expect(stopPromise).rejects.toThrow("ffmpeg: capture failed");
  });

  it("should report the signal when ffmpeg exits without stderr", async () => {
    const stopPromise = stopRecording();

    mockProcess.emit("close", null, "SIGTERM");

    await expect(stopPromise).rejects.toThrow(
      "ffmpeg recording failed (signal SIGTERM)",
    );
  });

  it("should reject if ffmpeg fails to spawn", async () => {
    const stopPromise = stopRecording();
    const spawnError = new Error("unable to spawn ffmpeg");

    mockProcess.emit("error", spawnError);

    await expect(stopPromise).rejects.toBe(spawnError);
  });
});
