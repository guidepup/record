import { record } from "./record";
import { record as recordWithCommand } from "../common/record";

jest.mock("../common/record", () => ({
  record: jest.fn(() => jest.fn()),
}));

describe("Linux record", () => {
  const originalDisplay = process.env.DISPLAY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DISPLAY = ":1.0";
  });

  afterAll(() => {
    if (originalDisplay === undefined) {
      delete process.env.DISPLAY;
    } else {
      process.env.DISPLAY = originalDisplay;
    }
  });

  it("should pass the X11 ffmpeg arguments to the common recorder", () => {
    const filepath = "recordings/linux.mp4";

    record(filepath);

    expect(recordWithCommand).toHaveBeenCalledWith(filepath, [
      "-f",
      "x11grab",
      "-framerate",
      "60",
      "-i",
      ":1.0",
      "-pix_fmt",
      "yuv420p",
      "-vcodec",
      "mpeg4",
      filepath,
    ]);
  });

  it("should report when no X11 display is configured", () => {
    delete process.env.DISPLAY;

    expect(() => record("recordings/linux.mp4")).toThrow(
      "Linux recording requires an X11 display; the DISPLAY environment variable is not set.",
    );
    expect(recordWithCommand).not.toHaveBeenCalled();
  });
});
