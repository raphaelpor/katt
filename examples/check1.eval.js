describe('Hello World', () => {
    it('It should say hi', async () => {
        const result = await prompt('If you read this just say hi');
        expect(result.toLowerCase()).toContain('hi');
    });

    it('should return the date in a json format', async () => {
        const currentData = new Date(Date.now());

        const result = await prompt('Return the current year in the format "{ year: YYYY }"');
        expect(result).toContain(`{ year: ${currentData.getFullYear()} }`);
    });

    it('should classify a response as helpful', async () => {
        const response = await prompt('You are a helpful assistant. Give one short tip for learning JavaScript.');
        await expect(response).toBeClassifiedAs('helpful', { threshold: 3 });
    });
});


const result2 = await prompt('If you read this just say heeey');
expect(result2.toLowerCase()).toMatchSnapshot();
