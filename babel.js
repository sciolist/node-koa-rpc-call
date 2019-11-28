'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var t = require('@babel/types');
var path = _interopDefault(require('path'));

module.exports = function KoaRpcCallBabel({ template, parse }, babelOptions) {
    const configFile = parse(`(${JSON.stringify(babelOptions || {})})`, { filename: 'babel-config' });
    const configProperties = configFile.program.body[0].expression.properties;
    const newFile = template(`
  Object.defineProperty(exports, "__esModule", { value: true });
  var b = require(${JSON.stringify(path.resolve(__dirname, 'browser'))});
  var o = exports['default'] = {};
  `);
    const createProxyTpl = template(`
  o[%%methodName%%] = b.createRpcProxy(%%className%%, %%methodName%%, %%configuration%%);
  `);
    let exportInstance = '';
    let currentClass = '';
    let methods = {};
    const validClientNames = new Set(['httpMethod', 'urlName', 'client']);
    function filterClientConfiguration(cfg, path) {
        if (!cfg) {
            return t.objectExpression(configProperties);
        }
        let objectExpr = cfg;
        if (cfg.type === 'Identifier') {
            const bound = path.scope.getBinding(cfg.name);
            const boundNode = bound.path.node;
            if (boundNode.type === 'VariableDeclarator') {
                objectExpr = boundNode.init;
            }
        }
        if (objectExpr.type === 'ObjectExpression') {
            let resultProps = {};
            for (const p of configProperties) {
                resultProps[p.key.name] = p;
            }
            for (const p of objectExpr.properties) {
                if (p.type !== 'ObjectProperty')
                    return false;
                if (validClientNames.has(p.key.name)) {
                    resultProps[p.key.name] = p;
                }
            }
            return t.objectExpression(Object.values(resultProps));
        }
    }
    function getClassMethodName(name) {
        if (name.type === 'Identifier') {
            return t.stringLiteral(name.name);
        }
        return name;
    }
    const visitor = {
        Class(path) {
            currentClass = path.node.id.name;
            methods[currentClass] = [];
        },
        ClassMethod(path) {
            const classDecl = path.findParent(p => p.type === 'ClassDeclaration');
            if (!path.node.decorators)
                return;
            for (const decor of path.node.decorators) {
                if (decor.expression.type !== 'CallExpression') {
                    continue;
                }
                if (!decor.expression.callee || decor.expression.callee.type !== 'Identifier') {
                    continue;
                }
                if (decor.expression.callee.name !== 'rpc') {
                    continue;
                }
                const configuration = decor.expression.arguments;
                methods[classDecl.node.id.name].push({
                    className: classDecl.node.id.name,
                    methodName: getClassMethodName(path.node.key),
                    configuration: filterClientConfiguration(configuration[0], path)
                });
            }
        },
        ExportDefaultDeclaration(inPath) {
            const scope = inPath.scope;
            let path = inPath;
            let node = path.node.declaration;
            while (node && node.type !== 'NewExpression') {
                if (node.type === 'Identifier') {
                    const bound = scope.getBinding(node.name);
                    node = bound.path.node;
                }
                else if (node.type === 'VariableDeclarator') {
                    node = node.init;
                }
                else {
                    throw new Error('could not find default export');
                }
            }
            if (node.type === 'NewExpression') {
                if (node.callee.type === 'Identifier') {
                    exportInstance = node.callee.name;
                }
            }
        }
    };
    function post(s) {
        const newBody = [];
        if (exportInstance) {
            const exportMethods = methods[exportInstance] || [];
            const methodProxies = exportMethods.map(em => createProxyTpl({
                className: t.stringLiteral(em.className),
                methodName: em.methodName,
                configuration: em.configuration
            }));
            const result = newFile({});
            newBody.push(...result, ...methodProxies);
        }
        const program = s.path.container.program;
        program.body = newBody;
    }
    return {
        visitor,
        post
    };
};
