import { Context } from 'koa';
import { NextFunction } from 'connect';
import { KoaRpcConfiguration, RpcConfiguration, RpcFunction, RpcDescriptor } from './types';
export * from 'blobloblob';
export default function createRpcRouter(config: KoaRpcConfiguration): void;
export declare function rpc(configuration?: RpcConfiguration): (inst: any, name: string, instance: TypedPropertyDescriptor<RpcFunction>) => void;
export declare function getDescriptorsForClass(cls: any): Set<RpcDescriptor>;
export declare function getDescriptors(apis: Array<Function>): RpcDescriptor[];
export declare function setRpcMethodContextFactory(desc: RpcDescriptor): (ctx: Context, next: NextFunction) => Promise<void>;
export declare function readRpcArguments(ctx: Context, next: NextFunction): Promise<void>;
export declare function callRpcMethod(ctx: Context, next: NextFunction): Promise<void>;
export declare function setRpcResponse(ctx: Context, next: NextFunction): Promise<void>;
