import { Context, Middleware } from "koa";

declare module 'koa' {
  interface Context {
    rpc?: RpcContext;
  }
}

export type RpcFunction = (...args: any[]) => Promise<any>;

export interface RpcContext {
  arguments?: any[];
  body?: any;
  method?: RpcDescriptor;
}

export interface KoaRpcConfiguration {
  urlPrefix?: string;
  apis: Array<Function>;
  register(httpMethod: string, urlName: string, sequence: Middleware[], descriptor: RpcDescriptor): void;
}

export interface RpcDescriptor extends RpcConfiguration {
  invoke: (ctx: Context, args: any[]) => Promise<any>;
}

export interface RpcConfiguration {
  httpMethod?: string;
  urlName?: string;
  urlPrefix?: string;
}
