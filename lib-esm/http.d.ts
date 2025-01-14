/// <reference types="node" />
import * as hrana from "@libsql/hrana-client";
import type { Config, Client } from "./api.js";
import type { InStatement, ResultSet, Transaction, IntMode } from "./api.js";
import { TransactionMode } from "./api.js";
import type { ExpandedConfig } from "./config.js";
import { HranaTransaction } from "./hrana.js";
import { SqlCache } from "./sql_cache.js";
export * from "./api.js";
export declare function createClient(config: Config): Client;
/** @private */
export declare function _createClient(config: ExpandedConfig): Client;
export declare class HttpClient implements Client {
    #private;
    protocol: "http";
    /** @private */
    constructor(url: URL, authToken: string | undefined, intMode: IntMode, customFetch: Function | undefined);
    execute(stmt: InStatement): Promise<ResultSet>;
    batch(stmts: Array<InStatement>, mode?: TransactionMode): Promise<Array<ResultSet>>;
    transaction(mode?: TransactionMode): Promise<HttpTransaction>;
    executeMultiple(sql: string): Promise<void>;
    sync(): Promise<void>;
    close(): void;
    get closed(): boolean;
}
export declare class HttpTransaction extends HranaTransaction implements Transaction {
    #private;
    /** @private */
    constructor(stream: hrana.HttpStream, mode: TransactionMode, version: hrana.ProtocolVersion);
    /** @private */
    _getStream(): hrana.Stream;
    /** @private */
    _getSqlCache(): SqlCache;
    close(): void;
    get closed(): boolean;
}
