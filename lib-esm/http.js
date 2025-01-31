import * as hrana from "@libsql/hrana-client";
import { LibsqlError } from "./api.js";
import { expandConfig } from "./config.js";
import { HranaTransaction, executeHranaBatch, stmtToHrana, resultSetFromHrana, mapHranaError, } from "./hrana.js";
import { SqlCache } from "./sql_cache.js";
import { encodeBaseUrl } from "./uri.js";
import { supportedUrlLink } from "./util.js";
export * from "./api.js";
export function createClient(config) {
    return _createClient(expandConfig(config, true));
}
/** @private */
export function _createClient(config) {
    if (config.scheme !== "https" && config.scheme !== "http") {
        throw new LibsqlError('The HTTP client supports only "libsql:", "https:" and "http:" URLs, ' +
            `got ${JSON.stringify(config.scheme + ":")}. For more information, please read ${supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
    }
    if (config.scheme === "http" && config.tls) {
        throw new LibsqlError(`A "http:" URL cannot opt into TLS by using ?tls=1`, "URL_INVALID");
    }
    else if (config.scheme === "https" && !config.tls) {
        throw new LibsqlError(`A "https:" URL cannot opt out of TLS by using ?tls=0`, "URL_INVALID");
    }
    const url = encodeBaseUrl(config.scheme, config.authority, config.path);
    return new HttpClient(url, config.authToken, config.intMode, config.fetch);
}
const sqlCacheCapacity = 30;
export class HttpClient {
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
            const hranaStmt = stmtToHrana(stmt);
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
            return resultSetFromHrana(await rowsPromise);
        }
        catch (e) {
            throw mapHranaError(e);
        }
    }
    async batch(stmts, mode = "deferred") {
        try {
            const hranaStmts = stmts.map(stmtToHrana);
            const version = await this.#client.getVersion();
            // Pipeline all operations, so `hrana.HttpClient` can open the stream, execute the batch and
            // close the stream in a single HTTP request.
            let resultsPromise;
            const stream = this.#client.openStream();
            try {
                // It makes sense to use a SQL cache even for a single batch, because it may contain the same
                // statement repeated multiple times.
                const sqlCache = new SqlCache(stream, sqlCacheCapacity);
                sqlCache.apply(hranaStmts);
                // TODO: we do not use a cursor here, because it would cause three roundtrips:
                // 1. pipeline request to store SQL texts
                // 2. cursor request
                // 3. pipeline request to close the stream
                const batch = stream.batch(false);
                resultsPromise = executeHranaBatch(mode, version, batch, hranaStmts);
            }
            finally {
                stream.closeGracefully();
            }
            return await resultsPromise;
        }
        catch (e) {
            throw mapHranaError(e);
        }
    }
    async transaction(mode = "write") {
        try {
            const version = await this.#client.getVersion();
            return new HttpTransaction(this.#client.openStream(), mode, version);
        }
        catch (e) {
            throw mapHranaError(e);
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
            throw mapHranaError(e);
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
export class HttpTransaction extends HranaTransaction {
    #stream;
    #sqlCache;
    /** @private */
    constructor(stream, mode, version) {
        super(mode, version);
        this.#stream = stream;
        this.#sqlCache = new SqlCache(stream, sqlCacheCapacity);
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
