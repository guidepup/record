import { macOSRecord } from "../src";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const main = async () => {
  const stopRecording = macOSRecord("./recordings/macos-example.mov");

  await delay(3000);
  await stopRecording();
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
