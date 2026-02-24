import { describe, expect, it, prompt, promptFile } from "katt";

describe('Working with files', () => {
    it('It should load the file and compare', async () => {
        const result = await promptFile('./customPrompt.md');
        expect(result.toLowerCase()).toContain('hola');
    });
});
