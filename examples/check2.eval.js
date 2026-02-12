describe('Working with files', () => {
    it('It should load the file and compare', async () => {
        const result = await promptFile('./customPrompt.md');
        expect(result.toLowerCase()).toContain('hola');
    });
});

describe('Working with prompt as expectation', () => {
    it('It should be friendly', async () => {
        const result = await prompt('You are a friendly assistant. If you read this, say "Hola"!', { model: 'gpt-5.2' });
        expect(result).promptCheck('To be friendly, the response should contain a greeting.');
    });
});