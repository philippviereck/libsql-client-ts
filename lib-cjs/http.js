"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTransaction = exports.HttpClient = exports._createClient = exports.createClient = void 0;
const hrana = __importStar(require("@libsql/hrana-client"));
const api_js_1 = require("./api.js");
const config_js_1 = require("./config.js");
const hrana_js_1 = require("./hrana.js");
const sql_cache_js_1 = require("./sql_cache.js");
const uri_js_1 = require("./uri.js");
const util_js_1 = require("./util.js");
__exportStar(require("./api.js"), exports);
function createClient(config) {
    return _createClient((0, config_js_1.expandConfig)(config, true));
}
exports.createClient = createClient;
/** @private */
function _createClient(config) {
    if (config.scheme !== "https" && config.scheme !== "http") {
        throw new api_js_1.LibsqlError('The HTTP client supports only "libsql:", "https:" and "http:" URLs, ' +
            `got ${JSON.stringify(config.scheme + ":")}. For more information, please read ${util_js_1.supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
    }
    if (config.scheme === "http" && config.tls) {
        throw new api_js_1.LibsqlError(`A "http:" URL cannot opt into TLS by using ?tls=1`, "URL_INVALID");
    }
    else if (config.scheme === "https" && !config.tls) {
        throw new api_js_1.LibsqlError(`A "https:" URL cannot opt out of TLS by using ?tls=0`, "URL_INVALID");
    }
    const url = (0, uri_js_1.encodeBaseUrl)(config.scheme, config.authority, config.path);
    return new HttpClient(url, config.authToken, config.intMode, config.fetch);
}
exports._createClient = _createClient;
const sqlCacheCapacity = 30;
class HttpClient {
    #client;
    protocol;
    /** @private */
    constructor(url, authToken, intMode, customFetch) {
        this.#client = hrana.openHttp(url, authToken, customFetch);
        this.#client.intMode = intMode;
        this.protocol = "http";
    }
    async execute(stmt) {
        try {
            const hranaStmt = (0, hrana_js_1.stmtToHrana)(stmt);
            // Pipeline all operations, so `hrana.HttpClient` can open the stream, execute the statement and
            // close the stream in a single HTTP request.
            let rowsPromise;
            const stream = this.#client.openStream();
            try {
                rowsPromise = stream.query(hranaStmt);
            }
            finally {
                stream.closeGracefully();
            }
            return (0, hrana_js_1.resultSetFromHrana)(await rowsPromise);
        }
        catch (e) {
            throw (0, hrana_js_1.mapHranaError)(e);
        }
    }
    async batch(stmts, mode = "deferred") {
        try {
            const hranaStmts = stmts.map(hrana_js_1.stmtToHrana);
            const version = await this.#client.getVersion();
            // Pipeline all operations, so `hrana.HttpClient` can open the stream, execute the batch and
            // close the stream in a single HTTP request.
            let resultsPromise;
            const stream = this.#client.openStream();
            try {
                // It makes sense to use a SQL cache even for a single batch, because it may contain the same
                // statement repeated multiple times.
                const sqlCache = new sql_cache_js_1.SqlCache(stream, sqlCacheCapacity);
                sqlCache.apply(hranaStmts);
                // TODO: we do not use a cursor here, because it would cause three roundtrips:
                // 1. pipeline request to store SQL texts
                // 2. cursor request
                // 3. pipeline request to close the stream
                const batch = stream.batch(false);
                resultsPromise = (0, hrana_js_1.executeHranaBatch)(mode, version, batch, hranaStmts);
            }
            finally {
                stream.closeGracefully();
            }
            return await resultsPromise;
        }
        catch (e) {
            throw (0, hrana_js_1.mapHranaError)(e);
        }
    }
    async transaction(mode = "write") {
        try {
            const version = await this.#client.getVersion();
            return new HttpTransaction(this.#client.openStream(), mode, version);
        }
        catch (e) {
            throw (0, hrana_js_1.mapHranaError)(e);
        }
    }
    async executeMultiple(sql) {
        try {
            // Pipeline all operations, so `hrana.HttpClient` can open the stream, execute the sequence and
            // close the stream in a single HTTP request.
            let promise;
            const stream = this.#client.openStream();
            try {
                promise = stream.sequence(sql);
            }
            finally {
                stream.closeGracefully();
            }
            await promise;
        }
        catch (e) {
            throw (0, hrana_js_1.mapHranaError)(e);
        }
    }
    sync() {
        return Promise.resolve();
    }
    close() {
        this.#client.close();
    }
    get closed() {
        return this.#client.closed;
    }
}
exports.HttpClient = HttpClient;
class HttpTransaction extends hrana_js_1.HranaTransaction {
    #stream;
    #sqlCache;
    /** @private */
    constructor(stream, mode, version) {
        super(mode, version);
        this.#stream = stream;
        this.#sqlCache = new sql_cache_js_1.SqlCache(stream, sqlCacheCapacity);
    }
    /** @private */
    _getStream() {
        return this.#stream;
    }
    /** @private */
    _getSqlCache() {
        return this.#sqlCache;
    }
    close() {
        this.#stream.close();
    }
    get closed() {
        return this.#stream.closed;
    }
}
exports.HttpTransaction = HttpTransaction;
