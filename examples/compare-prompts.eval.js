import { describe, expect, it, prompt } from "katt";

const PROMPTS = [
  {
    name: "friendly",
    input: "Explain what HTTP is in one sentence with a friendly tone.",
  },
  {
    name: "formal",
    input: "Explain what HTTP is in one sentence with a formal tone.",
  },
];

describe("Compare prompt variants", () => {
  for (const { name, input } of PROMPTS) {
    it(`captures output for ${name} prompt`, async () => {
      const result = await prompt(input, { model: "gpt-5-mini" });
      expect(result).toContain("HTTP");
      expect(result).toMatchSnapshot();
    });
  }
});
