import { describe, expect, it, prompt } from "katt";

describe('Hello World', () => {
    it('should return the date in a json format', async () => {
        const currentData = new Date(Date.now());

        const result = await prompt('Return the current year in the format "{ year: YYYY }"');
        expect(result).toContain(`{ year: ${currentData.getFullYear()} }`);
    });
});
