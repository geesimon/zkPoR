"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var express_1 = require("express");
var dotenv_1 = require("dotenv");
var snarkyjs_1 = require("snarkyjs");
var Ledger_lib_js_1 = require("../contracts/src/Ledger-lib.js");
dotenv_1["default"].config();
var app = (0, express_1["default"])();
var port = getEnv('PORT', 3000);
var NetworkURL = getEnv('NETWORK_URL', 'https://proxy.berkeley.minaexplorer.com/graphql');
var transactionFee = 100000000;
var accountFileName = "../test-accounts.json";
var allAccounts;
function getEnv(name, defaultValue) {
    return (typeof process.env[name] === undefined) ? defaultValue : process.env[name];
}
(function InitMina() {
    return __awaiter(this, void 0, void 0, function () {
        var Berkeley;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Initializing...');
                    return [4 /*yield*/, snarkyjs_1.isReady];
                case 1:
                    _a.sent();
                    console.log('SnarkJS loaded');
                    Berkeley = snarkyjs_1.Mina.Network(NetworkURL);
                    snarkyjs_1.Mina.setActiveInstance(Berkeley);
                    console.log('Load account data');
                    return [4 /*yield*/, (0, Ledger_lib_js_1.loadAccounts)(accountFileName)];
                case 2:
                    allAccounts = _a.sent();
                    console.log('Done');
                    return [2 /*return*/];
            }
        });
    });
})();
app.get('/account/:id', function (req, res) {
    var account = allAccounts.get(Number(req.params.id));
    if (typeof account !== undefined) {
        res.json({ user: account });
    }
    else {
        res.json({ Error: "No such user" });
    }
});
app.get('/', function (req, res) {
    res.send('Hello World!!!');
});
app.listen(port, function () {
    console.log("\u26A1\uFE0F[server]: Server is running at https://localhost:".concat(port));
});
