/// <reference lib="dom" />
import { RpcConfiguration } from './types';
export interface RpcError extends Error {
    requestInfo: RpcRequestInit;
    response: Response;
}
export declare const configuration: RpcClientConfiguration;
export declare function configure(newConfiguration: Partial<RpcClientConfiguration>): void;
export declare function createRpcProxy(className: string, methodName: string, rpcConfiguration?: RpcConfiguration): (...rpcArguments: any[]) => Promise<any>;
export declare type RpcRequestInit = {
    url: string;
} & RequestInit;
export interface RpcClientConfiguration {
    urlPrefix: string;
    invoker: RpcClientInvoker;
    onRequest?(requestInfo: RpcRequestInit, finish: (init: RpcRequestInit) => Promise<any>): Promise<any>;
}
export declare type RpcClientInvoker = (className: string, methodName: string, rpcParameters: any[], rpcConfiguration?: Partial<RpcConfiguration>) => Promise<any>;
