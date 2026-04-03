const ESC = "\u001B";

export function stripAnsi(value: string): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const current = value[index];
    const next = value[index + 1];

    if (current === ESC && next === "[") {
      index += 2;
      while (index < value.length && value[index] !== "m") {
        index += 1;
      }
      if (index < value.length) {
        index += 1;
      }
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}
