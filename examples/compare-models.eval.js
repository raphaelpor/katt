import { describe, expect, it, prompt } from "katt";

const SHARED_PROMPT =
	"Explain what HTTP is in one sentence. Keep it clear and beginner-friendly.";

const MODELS = ["gpt-5-mini", "gpt-4o"];

describe("Compare model outputs", () => {
	for (const model of MODELS) {
		it(`captures output for ${model} with the same prompt`, async () => {
			const result = await prompt(SHARED_PROMPT, { model });
			expect(result).toContain("HTTP");
			expect(result).toMatchSnapshot();
		});
	}
});
