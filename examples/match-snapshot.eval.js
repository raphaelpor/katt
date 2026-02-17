import { describe, expect, it, prompt } from "katt";

describe('Hello World', () => {
    it('Greeting', async () => {
        const result2 = await prompt('If you read this just say "heeey" in lowercase.');
        expect(result2).toMatchSnapshot();
    });
});
