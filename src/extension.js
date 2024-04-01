const vscode = require('vscode');
const ncp = require('copy-paste');

// 最后我们需要的 res (js 对象类型,但是我们最后要的是字符串)
let res = null;
let resString = '';
// 过滤字符串,所有的 |n \t 以及两端的空格
const filterStringFn = (data) => data.trim().replaceAll('\n', '').replaceAll('\t', '');

// 判断 js 对象的类型,返回的类型为 undefined | null | boolean | string | number | object , 其他的都是大写
const typeArray = ['Boolean', 'String', 'Number', 'Object', 'Undefined', 'Null'];
const getTypeOfDataFn = (data) => {
    let res = Object.prototype.toString.call(data).slice(8, -1);
    if (typeArray.includes(res)) {
        return res.toLowerCase();
    }
    return res;
};

// 判断初始类型是啥,然后初始化 res
const initResFn = (initData) => {
    if (getTypeOfDataFn(initData) === 'object') return {};
    if (getTypeOfDataFn(initData) === 'Array') return [];
};

// 循环递归,将 js 中的所有的 属性值都改为字符串
const loopFn = (data, res) => {
    for (let key in data) {
        if (getTypeOfDataFn(data[key]) === 'object') {
            res[key] = {};
            loopFn(data[key], res[key]);
        } else if (getTypeOfDataFn(data[key]) === 'Array') {
            res[key] = [];
            loopFn(data[key], res[key]);
        } else {
            res[key] = getTypeOfDataFn(data[key]);
        }
    }
};

// 当👆面的循环结束后,要进行数组的去重
const removeDuplicateArrays = (obj) => {
    // 如果输入不是对象或者为 null，则直接返回
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    // 如果输入是数组，则对数组中的元素递归调用该函数
    if (Array.isArray(obj)) {
        const jsonObj = obj.map((item) => JSON.stringify(item));
        const filterArray = [...new Set(jsonObj)];
        let res = filterArray.map((item) => JSON.parse(item));
        res = res.map((item) => {
            if (Array.isArray(item) || getTypeOfDataFn(item) === 'object') {
                return removeDuplicateArrays(item);
            }
            return item;
        });

        return res;
    }

    // 如果输入是对象，则遍历对象的属性值
    for (const prop in obj) {
        // 对于数组类型的属性值，进行去重操作
        if (Array.isArray(obj[prop])) {
            obj[prop] = removeDuplicateArrays(obj[prop]);
        }
    }

    return obj;
};

// 循环添加字符串
const loopAddStringFn = (data) => {
    // 判断输入是否为对象或者为 null
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    let count = 0; // 如果是对象,记录下操作的 key 的数量,来判断哪一次是最后一次触发
    let len = Object.keys(data).length; // 记录 data 的总长度

    Object.entries(data).map(([key, value]) => {
        // 如果这里的 key 是可以转化为数组,也就是说此时的 data 是一个数组
        if (!isNaN(Number(key))) {
            // 如果这里的事数组或者是对象,则递归调用该函数;
            if (getTypeOfDataFn(value) === 'object' || Array.isArray(value)) {
                // 如果是索引为 0 的情况,
                if (key === '0') {
                    // 数组的长度如果大于 1,则需要使用小括号,因为一个元素是 string[],两个元素是(string|number)[]
                    if (len > 1) resString += '(';
                } else {
                    resString += '|';
                }
                if (JSON.stringify(value) === '{}') {
                    resString += '{}';
                }
                if (JSON.stringify(value) === '[]') {
                    resString += '[]';
                }
                loopAddStringFn(value); // 继续循环添加字符串

                // 如果这个数组已经进行到了最后一个元素
                if (Number(key) === len - 1) {
                    // 数组的长度如果大于 1,则需要使用小括号,因为一个元素是 string[],两个元素是(string|number)[]
                    if (len > 1) resString += ')';
                    resString += '[]';
                }
                return;
            }
            // 如果不是数组也不是对象
            if (key === '0') {
                // 数组的长度如果大于 1,则需要使用小括号,因为一个元素是 string[],两个元素是(string|number)[]
                if (len > 1) resString += '(';
                resString += value;
            } else {
                resString += `|${value}`;
            }

            // 如果这个数组已经进行到了最后一个元素
            if (Number(key) === len - 1) {
                // 数组的长度如果大于 1,则需要使用小括号,因为一个元素是 string[],两个元素是(string|number)[]
                if (len > 1) resString += ')';
                resString += '[]';
            }
        }
        // 不然这里就是对象, TODO:这里暂时不考虑 function 的参数,fucntion 统一为 Function 类型
        else {
            if (count === 0) {
                resString += '{';
            } else {
                resString += ',';
            }

            if (getTypeOfDataFn(value) === 'object' || Array.isArray(value)) {
                resString += `${key}:`;

                if (JSON.stringify(value) === '{}') {
                    resString += '{}';
                }
                if (JSON.stringify(value) === '[]') {
                    resString += '[]';
                }

                loopAddStringFn(value);
                count++; // 操作次数增加
                if (count === len) resString += '}';
                return;
            }

            resString += `${key}:${value}`;
            count++; // 操作次数增加
            if (count === len) resString += '}';
        }
    });
};

// 得到最后的 ts 数据
const getTsDataFn = (text) => {
    res = null; // 初始化 js 对象

    resString = 'export type xxxx = '; // 初始化最后的字符串

    let initData = new Function('return ' + filterStringFn(text))(); // 得到 js 对象

    // 判断初始类型是啥,然后初始化 res
    res = initResFn(initData);
    // 循环递归,将 js 中的所有的 属性值都改为字符串
    loopFn(initData, res);
    // 数组的去重
    res = removeDuplicateArrays(res);

    // 递归增加字符串
    loopAddStringFn(res);
    return resString;
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('js2ts.run', function () {
        ncp.paste(function (event, context) {
            try {
                const resString = getTsDataFn(context);
                console.log(resString);
                vscode.window.activeTextEditor.edit((editBuilder) => {
                    let startLine = vscode.window.activeTextEditor.selection.start.line;
                    let lastCharIndex = vscode.window.activeTextEditor.document.lineAt(startLine).text.length;
                    let position = new vscode.Position(startLine, lastCharIndex);
                    editBuilder.insert(position, resString);

                    vscode.window.setStatusBarMessage('Here are your TypeScript interfaces... Enjoy! :)');
                });
            } catch (error) {
                console.log(error.showErrorMessage());
                vscode.window.showErrorMessage('请确保您的剪切板内容是 json类型 或者是 js类型(对象/数组)');
            }
        });
        // vscode.window.showInformationMessage('Hello World from js2ts!');
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};
