import { AsyncLocalStorage } from "node:async_hooks";

type ContextEntry = {
  id: string;
  description: string;
};

type ContextState = {
  describeStack: ContextEntry[];
  itStack: ContextEntry[];
  tokenUsageStack: number[];
  modelStack: (string | undefined)[];
};

export type FailedTest = {
  describePath: string;
  itPath: string;
  message: string;
};

const contextStorage = new AsyncLocalStorage<ContextState>();
const fallbackState: ContextState = {
  describeStack: [],
  itStack: [],
  tokenUsageStack: [],
  modelStack: [],
};
let describeCounter = 0;
let itCounter = 0;
const pendingTests: Promise<void>[] = [];
const failedTests: FailedTest[] = [];
let totalTests = 0;

function getStore(): ContextState {
  return contextStorage.getStore() ?? fallbackState;
}

function cloneState(state: ContextState): ContextState {
  return {
    describeStack: [...state.describeStack],
    itStack: [...state.itStack],
    tokenUsageStack: [...state.tokenUsageStack],
    modelStack: [...state.modelStack],
  };
}

function nextDescribeId(): string {
  describeCounter += 1;
  return `d${describeCounter}`;
}

function nextItId(): string {
  itCounter += 1;
  return `i${itCounter}`;
}

export function runWithContext<T>(fn: () => T, state?: ContextState): T {
  const nextState = state ?? cloneState(getStore());
  return contextStorage.run(nextState, fn);
}

export function createChildContext(): ContextState {
  return cloneState(getStore());
}

export function pushDescribe(description: string): void {
  getStore().describeStack.push({ id: nextDescribeId(), description });
}

export function popDescribe(): void {
  getStore().describeStack.pop();
}

export function getDescribePath(): string {
  return getStore()
    .describeStack.map((entry) => entry.description)
    .join(" > ");
}

export function hasDescribeContext(): boolean {
  return getStore().describeStack.length > 0;
}

export function getDescribeContext(): ContextEntry[] {
  return [...getStore().describeStack];
}

export function pushIt(description: string): void {
  getStore().itStack.push({ id: nextItId(), description });
  getStore().tokenUsageStack.push(0);
  getStore().modelStack.push(undefined);
}

export function popIt(): void {
  getStore().itStack.pop();
  getStore().tokenUsageStack.pop();
  getStore().modelStack.pop();
}

export function getItPath(): string {
  return getStore()
    .itStack.map((entry) => entry.description)
    .join(" > ");
}

export function hasItContext(): boolean {
  return getStore().itStack.length > 0;
}

export function getItContext(): ContextEntry[] {
  return [...getStore().itStack];
}

export function resetDescribeContext(): void {
  getStore().describeStack.length = 0;
}

export function resetItContext(): void {
  getStore().itStack.length = 0;
  getStore().tokenUsageStack.length = 0;
  getStore().modelStack.length = 0;
}

export function addUsedTokensToCurrentTest(tokens: number): void {
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return;
  }

  const store = getStore();
  const index = store.tokenUsageStack.length - 1;
  if (index < 0) {
    return;
  }

  store.tokenUsageStack[index] += tokens;
}

export function getCurrentTestTokenUsage(): number {
  const store = getStore();
  const index = store.tokenUsageStack.length - 1;
  if (index < 0) {
    return 0;
  }
  return store.tokenUsageStack[index] ?? 0;
}

export function setCurrentTestModel(model: string): void {
  if (model.length === 0) {
    return;
  }

  const store = getStore();
  const index = store.modelStack.length - 1;
  if (index < 0) {
    return;
  }

  store.modelStack[index] = model;
}

export function getCurrentTestModel(): string | undefined {
  const store = getStore();
  const index = store.modelStack.length - 1;
  if (index < 0) {
    return undefined;
  }
  return store.modelStack[index];
}

export function registerPendingTest(promise: Promise<void>): void {
  pendingTests.push(promise);
}

export function registerTest(): void {
  totalTests += 1;
}

export function getTotalTests(): number {
  return totalTests;
}

export function clearTotalTests(): void {
  totalTests = 0;
}

export function registerFailedTest(failedTest: FailedTest): void {
  failedTests.push(failedTest);
}

export function getFailedTests(): FailedTest[] {
  return [...failedTests];
}

export function getFailedTestCount(): number {
  return failedTests.length;
}

export function clearFailedTests(): void {
  failedTests.length = 0;
}

export async function settlePendingTests(): Promise<
  PromiseSettledResult<void>[]
> {
  const settledResults: PromiseSettledResult<void>[] = [];

  while (pendingTests.length > 0) {
    const toSettle = pendingTests.splice(0, pendingTests.length);
    const chunkResults = await Promise.allSettled(toSettle);
    settledResults.push(...chunkResults);
  }

  return settledResults;
}
