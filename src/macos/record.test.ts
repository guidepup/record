import { record } from "./record";
import { record as recordWithCommand } from "../common/record";

jest.mock("../common/record", () => ({
  record: jest.fn(() => jest.fn()),
}));

const mockFilepath = "test-directory/test-filepath.ext";

describe("macOS record", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should pass the macOS ffmpeg arguments to the common recorder", () => {
    record(mockFilepath);

    expect(recordWithCommand).toHaveBeenCalledWith(mockFilepath, [
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
      mockFilepath,
    ]);
  });
});
