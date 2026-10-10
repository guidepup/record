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
const mockArguments = ["-f", "test-format", mockFilepath];

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
    kill: jest.fn((signal: NodeJS.Signals) => Boolean(signal)),
  });
};

let mockProcess: ReturnType<typeof createMockProcess>;

describe("common record", () => {
  let stopRecording: () => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcess = createMockProcess();
    jest.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);

    stopRecording = record(mockFilepath, mockArguments);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should create the directory path", () => {
    expect(mkdirSync).toHaveBeenCalledWith(mockDirectory, { recursive: true });
  });

  it("should delete the file if it already exists", () => {
    expect(unlinkSync).toHaveBeenCalledWith(mockFilepath);
  });

  it("should spawn ffmpeg with the supplied arguments", () => {
    expect(spawn).toHaveBeenCalledWith("test-ffmpeg", mockArguments, {
      stdio: ["pipe", "ignore", "pipe"],
    });
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
    mockProcess.emit("close", 0, null);

    const stopPromise = stopRecording();

    expect(mockProcess.stdin.end).not.toHaveBeenCalled();
    await expect(stopPromise).resolves.toBeUndefined();
  });

  it("should treat SIGINT as a successful ffmpeg exit", async () => {
    const stopPromise = stopRecording();

    mockProcess.emit("close", null, "SIGINT");

    await expect(stopPromise).resolves.toBeUndefined();
  });

  it("should await close if the process exited but close has not fired", async () => {
    jest.useFakeTimers();
    const stopPromise = stopRecording();
    const rejection = expect(stopPromise).rejects.toThrow(
      "ffmpeg recording exited but did not emit close within 5000ms",
    );

    mockProcess.exitCode = 0;
    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();

    expect(mockProcess.kill).not.toHaveBeenCalled();
    await rejection;
  });

  it("should send SIGTERM if ffmpeg ignores q", async () => {
    jest.useFakeTimers();
    mockProcess.kill.mockImplementation((signal) => {
      if (signal === "SIGTERM") {
        mockProcess.signalCode = signal;
        mockProcess.emit("close", null, signal);
      }
      return true;
    });

    const stopPromise = stopRecording();
    await jest.advanceTimersToNextTimerAsync();

    expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM");
    await expect(stopPromise).resolves.toBeUndefined();
  });

  it("should send SIGKILL if ffmpeg ignores q and SIGTERM", async () => {
    jest.useFakeTimers();
    mockProcess.kill.mockImplementation((signal) => {
      if (signal === "SIGKILL") {
        mockProcess.signalCode = signal;
        mockProcess.emit("close", null, signal);
      }
      return true;
    });

    const stopPromise = stopRecording();
    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();

    expect(mockProcess.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(mockProcess.kill).toHaveBeenNthCalledWith(2, "SIGKILL");
    await expect(stopPromise).resolves.toBeUndefined();
  });

  it("should reject if ffmpeg remains alive after SIGKILL", async () => {
    jest.useFakeTimers();
    const stopPromise = stopRecording();
    const rejection = expect(stopPromise).rejects.toThrow(
      "ffmpeg recording did not close after SIGKILL within 5000ms: ffmpeg is stuck",
    );

    mockProcess.stderr.emit("data", "ffmpeg is stuck");
    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();

    expect(mockProcess.kill).toHaveBeenNthCalledWith(1, "SIGTERM");
    expect(mockProcess.kill).toHaveBeenNthCalledWith(2, "SIGKILL");
    await rejection;
  });

  it("should reject with context if sending a termination signal fails", async () => {
    jest.useFakeTimers();
    mockProcess.kill.mockImplementation(() => {
      throw new Error("signal delivery failed");
    });

    const stopPromise = stopRecording();
    const rejection = expect(stopPromise).rejects.toThrow(
      "Unable to send SIGTERM to ffmpeg recording: signal delivery failed",
    );

    await jest.advanceTimersToNextTimerAsync();
    await rejection;
  });

  it("should include non-Error signal failures in the rejection context", async () => {
    jest.useFakeTimers();
    mockProcess.kill.mockImplementation(() => {
      throw "signal delivery failed";
    });

    const stopPromise = stopRecording();
    const rejection = expect(stopPromise).rejects.toThrow(
      "Unable to send SIGTERM to ffmpeg recording: signal delivery failed",
    );

    await jest.advanceTimersToNextTimerAsync();
    await rejection;
  });

  it("should reject if close does not follow SIGTERM", async () => {
    jest.useFakeTimers();
    mockProcess.kill.mockImplementation((signal) => {
      if (signal === "SIGTERM") {
        mockProcess.signalCode = signal;
      }
      return true;
    });

    const stopPromise = stopRecording();
    const rejection = expect(stopPromise).rejects.toThrow(
      "ffmpeg recording did not close after SIGTERM within 5000ms",
    );

    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();
    await jest.advanceTimersToNextTimerAsync();
    await rejection;
  });

  it("should include stderr when ffmpeg fails", async () => {
    const stopPromise = stopRecording();

    mockProcess.stderr.emit("data", "ffmpeg: capture failed");
    mockProcess.emit("close", 1, null);

    await expect(stopPromise).rejects.toThrow("ffmpeg: capture failed");
  });

  it("should report a signal when ffmpeg exits without stderr", async () => {
    const stopPromise = stopRecording();

    mockProcess.emit("close", null, "SIGTERM");

    await expect(stopPromise).rejects.toThrow(
      "ffmpeg recording failed (signal SIGTERM)",
    );
  });

  it("should reject if ffmpeg fails to spawn", async () => {
    const spawnError = new Error("unable to spawn ffmpeg");
    mockProcess.emit("error", spawnError);

    const stopPromise = stopRecording();

    expect(mockProcess.stdin.end).not.toHaveBeenCalled();
    await expect(stopPromise).rejects.toBe(spawnError);
  });
});
