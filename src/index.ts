import { record as recordLinux } from "./linux/record";
import { record as recordMacOS } from "./macos/record";
import { record as recordWindows } from "./windows/record";

export { record as macOSRecord } from "./macos/record";
export { record as windowsRecord } from "./windows/record";
export { record as linuxRecord } from "./linux/record";

export function record(filepath: string): () => Promise<void> {
  switch (process.platform) {
    case "darwin":
      return recordMacOS(filepath);
    case "win32":
      return recordWindows(filepath);
    case "linux":
      return recordLinux(filepath);
    default:
      throw new Error(
        `Screen recording is not supported on the "${process.platform}" platform.`,
      );
  }
}
