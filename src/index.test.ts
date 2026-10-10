import { record as recordAutomatically } from "./index";
import { record as recordLinux } from "./linux/record";
import { record as recordMacOS } from "./macos/record";
import { record as recordWindows } from "./windows/record";

jest.mock("./linux/record", () => ({
  record: jest.fn(() => jest.fn()),
}));
jest.mock("./macos/record", () => ({
  record: jest.fn(() => jest.fn()),
}));
jest.mock("./windows/record", () => ({
  record: jest.fn(() => jest.fn()),
}));

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  process,
  "platform",
);

describe("record", () => {
  const filepath = "recordings/screen.mp4";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", originalPlatformDescriptor);
  });

  it("should select the macOS recorder on Darwin", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });

    recordAutomatically(filepath);

    expect(recordMacOS).toHaveBeenCalledWith(filepath);
    expect(recordWindows).not.toHaveBeenCalled();
    expect(recordLinux).not.toHaveBeenCalled();
  });

  it("should select the Windows recorder on Windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });

    recordAutomatically(filepath);

    expect(recordWindows).toHaveBeenCalledWith(filepath);
    expect(recordMacOS).not.toHaveBeenCalled();
    expect(recordLinux).not.toHaveBeenCalled();
  });

  it("should select the Linux recorder on Linux", () => {
    Object.defineProperty(process, "platform", { value: "linux" });

    recordAutomatically(filepath);

    expect(recordLinux).toHaveBeenCalledWith(filepath);
    expect(recordMacOS).not.toHaveBeenCalled();
    expect(recordWindows).not.toHaveBeenCalled();
  });

  it("should report unsupported platforms", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });

    expect(() => recordAutomatically(filepath)).toThrow(
      'Screen recording is not supported on the "freebsd" platform.',
    );
  });
});
