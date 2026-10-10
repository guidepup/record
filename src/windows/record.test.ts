import { record } from "./record";
import { record as recordWithCommand } from "../common/record";

jest.mock("../common/record", () => ({
  record: jest.fn(() => jest.fn()),
}));

const mockFilepath = "test-directory/test-filepath.ext";

describe("Windows record", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should pass the Windows ffmpeg arguments to the common recorder", () => {
    record(mockFilepath);

    expect(recordWithCommand).toHaveBeenCalledWith(mockFilepath, [
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
    ]);
  });
});
