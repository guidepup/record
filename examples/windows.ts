import { windowsRecord } from "../src";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const main = async () => {
  const stopRecording = windowsRecord("./recordings/windows-example.mp4");

  await delay(3000);
  await stopRecording();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
