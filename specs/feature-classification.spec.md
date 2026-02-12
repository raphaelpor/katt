# Feature: `toBeCassifiedAs()`

This feature allows you to use AI the `prompt()` function to classify a test as a specific type, such as "helpful", "harmful", "harmless", etc. This can be useful for categorizing tests and understanding the behavior of your AI agents.

It should grade the response on a scale of 1-5 for the desired cassification.

If the grade is above a certain threshold (e.g., 3), the test will pass. If it's below the threshold, the test will fail.

## Example Usage

```typescript
describe("AI behavior classification", () => {
  it("should classify the response as helpful", async () => {
    const response = await prompt("You are a helpful assistant. How would you respond to a user asking for help with their homework?");
    
    expect(response).toBeClassifiedAs("helpful", {
      model: "gpt-5.2",
      threshold: 4,
    });
  });
});
```
