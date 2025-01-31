/// <reference types="node" />
import * as hrana from "@libsql/hrana-client";
import type { Config, IntMode, Client, Transaction, ResultSet, InStatement } from "./api.js";
import { TransactionMode } from "./api.js";
import type { ExpandedConfig } from "./config.js";
import { HranaTransaction } from "./hrana.js";
import { SqlCache } from "./sql_cache.js";
export * from "./api.js";
export declare function createClient(config: Config): WsClient;
/** @private */
export declare function _createClient(config: ExpandedConfig): WsClient;
interface ConnState {
    client: hrana.WsClient;
    useSqlCache: boolean | undefined;
    sqlCache: SqlCache;
    openTime: Date;
    streamStates: Set<StreamState>;
}
interface StreamState {
    conn: ConnState;
    stream: hrana.WsStream;
}
export declare class WsClient implements Client {
    #private;
    closed: boolean;
    protocol: "ws";
    /** @private */
    constructor(client: hrana.WsClient, url: URL, authToken: string | undefined, intMode: IntMode);
    execute(stmt: InStatement): Promise<ResultSet>;
    batch(stmts: Array<InStatement>, mode?: TransactionMode): Promise<Array<ResultSet>>;
    transaction(mode?: TransactionMode): Promise<WsTransaction>;
    executeMultiple(sql: string): Promise<void>;
    sync(): Promise<void>;
    _closeStream(streamState: StreamState): void;
    close(): void;
}
export declare class WsTransaction extends HranaTransaction implements Transaction {
    #private;
    /** @private */
    constructor(client: WsClient, state: StreamState, mode: TransactionMode, version: hrana.ProtocolVersion);
    /** @private */
    _getStream(): hrana.Stream;
    /** @private */
    _getSqlCache(): SqlCache;
    close(): void;
    get closed(): boolean;
}
