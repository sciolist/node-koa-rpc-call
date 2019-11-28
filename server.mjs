import { FormData, File, read } from 'blobloblob';
export * from 'blobloblob';

const FILEPREFIX = '[:FILE:]';
async function createBody(result) {
    if (isFile(result)) {
        return {
            body: toBody(result),
            headers: {
                'Content-Type': result.type,
                'Content-Disposition': `attachment; filename=${JSON.stringify(result.name || 'file')}`
            }
        };
    }
    let files = [];
    const json = JSON.stringify(result, (key, value) => {
        if (typeof value === 'string' && FILEPREFIX === value) {
            throw new Error('disallowed value');
        }
        if (isFile(value)) {
            files.push(value);
            return FILEPREFIX;
        }
        return value;
    });
    if (files.length === 0) {
        return { body: json, headers: { 'Content-Type': 'application/json' } };
    }
    const formData = new FormData();
    formData.append('json', json);
    for (let i = 0; i < files.length; ++i) {
        formData.append(FILEPREFIX + i, files[i], files[i].name);
    }
    return {
        headers: formData.headers || {},
        body: toBody(formData)
    };
}
function toBody(data) {
    if (isStreamable(data))
        return data.stream();
    if (hasStream(data))
        return data.stream;
    return data;
}
async function readBody(contentType, response) {
    if (/^application\/json/.test(contentType)) {
        return await response.json();
    }
    if (!/^multipart\/form-data/.test(contentType)) {
        let filename = 'file';
        const header = response.headers;
        const disposition = header &&
            (typeof header.get === 'function' ? header.get('content-disposition') : header['content-disposition'])
            || '';
        const match = disposition.match(/filename=\"(.*?)\"/);
        if (match) {
            filename = match[1];
        }
        const buffer = await response.blob();
        return new File([buffer], filename, { type: contentType });
    }
    const formData = await response.formData();
    const json = formData.get('json');
    let i = 0;
    return JSON.parse(String(json), (key, value) => {
        if (typeof value !== 'string')
            return value;
        const match = value === FILEPREFIX;
        if (!match)
            return value;
        return formData.get(FILEPREFIX + i++);
    });
}
function isFile(value) {
    return value && (value[Symbol.toStringTag] === 'Blob' || value[Symbol.toStringTag] === 'File');
}
function isStreamable(value) {
    return value && 'stream' in value && typeof value.stream === 'function';
}
function hasStream(value) {
    return value && 'stream' in value && typeof value.stream === 'object';
}

const methods$ = Symbol('rpcMethods');
function createRpcRouter(config) {
    const cfgPrefix = config.urlPrefix || '/rpc';
    for (const desc of getDescriptors(config.apis)) {
        const httpMethod = (desc.httpMethod || 'post').toLowerCase();
        const urlPrefix = (desc.urlPrefix || cfgPrefix).replace(/\/$/, '') + '/';
        const url = urlPrefix + desc.urlName;
        const sequence = [setRpcMethodContextFactory(desc), readRpcArguments, callRpcMethod, setRpcResponse];
        config.register(httpMethod, url, sequence, desc);
    }
}
function rpc(configuration) {
    return function apiDecorator(inst, name, instance) {
        const methods = getDescriptorsForClass(inst.constructor);
        methods.add({
            urlName: `${inst.constructor.name}.${name}`,
            ...configuration,
            async invoke(ctx, args) {
                const cls = new inst.constructor(ctx, args);
                return await cls[name].apply(cls, args);
            }
        });
    };
}
function getDescriptorsForClass(cls) {
    return cls[methods$] || (cls[methods$] = new Set());
}
function getDescriptors(apis) {
    let descriptors = [];
    for (const cls of Array.from(apis.values())) {
        if (typeof cls !== 'function' || !cls.prototype) {
            throw new Error('rpc apis must be class constructors');
        }
        const methods = getDescriptorsForClass(cls);
        for (const desc of Array.from(methods.values())) {
            descriptors.push(desc);
        }
    }
    return descriptors;
}
function setRpcMethodContextFactory(desc) {
    return async function setRpcMethodContext(ctx, next) {
        if (!ctx.rpc)
            ctx.rpc = {};
        ctx.rpc.method = desc;
        return await next();
    };
}
async function readRpcArguments(ctx, next) {
    if (!ctx.rpc)
        ctx.rpc = {};
    if (ctx.method === 'GET') {
        const args = ctx.request.query.args || '[]';
        ctx.rpc.arguments = JSON.parse(args);
    }
    else {
        const response = read([ctx.req], { headers: ctx.req.headers });
        ctx.rpc.arguments = await readBody(ctx.request.type, response);
    }
    return await next();
}
async function callRpcMethod(ctx, next) {
    if (!ctx.rpc)
        return await next();
    const args = ctx.rpc.arguments || [];
    if (ctx.rpc.method) {
        ctx.rpcBody = await ctx.rpc.method.invoke(ctx, args);
    }
    return await next();
}
async function setRpcResponse(ctx, next) {
    if (ctx.body === undefined && ctx.rpcBody !== undefined) {
        let rpcBody = ctx.rpcBody;
        const response = await createBody(rpcBody);
        ctx.status = response.body === undefined ? 204 : 200;
        ctx.set(response.headers);
        ctx.body = response.body;
    }
    return await next();
}

export default createRpcRouter;
export { callRpcMethod, getDescriptors, getDescriptorsForClass, readRpcArguments, rpc, setRpcMethodContextFactory, setRpcResponse };
