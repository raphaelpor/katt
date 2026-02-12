import { AsyncLocalStorage } from "node:async_hooks";

export type EvalFileContext = {
  evalFile: string;
};

export const evalFileStorage = new AsyncLocalStorage<EvalFileContext>();
