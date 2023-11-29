function delay(milliseconds: any) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Duration in ms
export async function time(duration: number) {
  console.log("Start of delay");
  await delay(duration);
  console.log("End of delay");
}