'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var FILEPREFIX = '[:FILE:]';
var File = window.File;
var FormData = window.FormData;

var configuration = {
    urlPrefix: '/rpc',
    invoker: defaultApiInvoker
};

function configure(newConfiguration) {
    Object.assign(configuration, newConfiguration);
}

function createBody(result) {
    return Promise.resolve(null).then(function createBodyInner() {
        if (isFile(result)) {
            return {
                body: toBody(result),
                headers: {
                    'Content-Type': result.type,
                    'Content-Disposition': "attachment; filename=" + JSON.stringify(result.name || 'file')
                }
            };
        }
        var files = [];
        var json = JSON.stringify(result, function (key, value) {
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
        formData = new FormData();
        formData.append('json', json);
        for (i = 0; i < files.length; ++i) {
            formData.append(FILEPREFIX + i, files[i], files[i].name);
        }
        return { body: toBody(formData), headers: formData.headers || {} };
    });
}
function toBody(data) {
    if (isStreamable(data))
        return data.stream();
    if (hasStream(data))
        return data.stream;
    return data;
}
function readBody(contentType, response) {
    return Promise.resolve(null).then(function readyBodyInner() {
        if (!contentType || /^application\/undefined/.test(contentType)) {
            return;
        }
        if (/^application\/json/.test(contentType)) {
            return response.json();
        }
        if (!/^multipart\/form-data/.test(contentType)) {
            var filename = 'file';
            var header = response.headers;
            var disposition = header &&
                (typeof header.get === 'function' ? header.get('content-disposition') : header['content-disposition'])
                || '';
            var match = disposition.match(/filename=\"(.*?)\"/);
            if (match) {
                filename = match[1];
            }
            return response.blob().then(function (blob) {
                return new File([blob], filename);
            });
        }
        return response.formData().then(function (formData) {
            var json = formData.get('json');
            var i = 0;
            return JSON.parse(String(json), function (key, value) {
                if (typeof value !== 'string')
                    return value;
                var match = value === FILEPREFIX;
                if (!match)
                    return value;
                return formData.get(FILEPREFIX + i++);
            });
        });
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

function defaultApiInvoker(className, methodName, rpcParameters, rpcConfiguration) {
    return Promise.resolve(null).then(function invokeApi() {
        var httpMethod = (rpcConfiguration.httpMethod || 'POST').toUpperCase();
        var urlName = rpcConfiguration.urlName || className + "." + methodName;
        var urlPrefix = (rpcConfiguration.urlPrefix || configuration.urlPrefix).replace(/\/$/, '') + '/';
        var requestQuery = "";
        var requestHeaders = {};
        var createdBody = Promise.resolve(null);
        if (httpMethod !== 'GET') {
            createdBody = createBody(rpcParameters);
        } else {
            var json = JSON.stringify(rpcParameters || []);
            requestQuery = "?args=" + encodeURIComponent(json);
        }
        return createdBody.then(function (bodyInfo) {
            if (bodyInfo && bodyInfo.headers) {
                Object.assign(requestHeaders, headers);
            }
            var requestInfo = {
                url: urlPrefix + urlName + requestQuery,
                cache: 'default',
                credentials: 'same-origin',
                headers: requestHeaders,
                method: httpMethod,
                body: bodyInfo ? bodyInfo.body : null
            };
            if (configuration.onRequest) {
                return configuration.onRequest(requestInfo, finishRequest);
            } else {
                return finishRequest(requestInfo);
            }
        })
    });
}
function finishRequest(requestInfo) {
    return Promise.resolve(null).then(function finishRequestBody() {
        resolve(fetch(requestInfo.url, requestInfo).then(function (response) {
            if (response.status >= 300) {
                rpcError = new Error(requestInfo.url + " failed, HTTP " + response.status);
                rpcError.requestInfo = requestInfo;
                rpcError.response = response;
                throw rpcError;
            }
            return readBody(response.headers.get('content-type'), response);
        }));
    });
}
function createRpcProxy(className, methodName, rpcConfiguration) {
    var cfg = rpcConfiguration || {};
    return function rpcProxy() {
        var rpcArguments = Array.prototype.slice.call(arguments);
        return configuration.invoker(className, methodName, rpcArguments, cfg);
    };
}

exports.configuration = configuration;
exports.configure = configure;
exports.createRpcProxy = createRpcProxy;
