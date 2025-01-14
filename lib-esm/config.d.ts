import type { Config, IntMode } from "./api.js";
import type { Authority } from "./uri.js";
export interface ExpandedConfig {
    scheme: ExpandedScheme;
    tls: boolean;
    authority: Authority | undefined;
    path: string;
    authToken: string | undefined;
    syncUrl: string | undefined;
    intMode: IntMode;
    fetch: Function | undefined;
}
export type ExpandedScheme = "wss" | "ws" | "https" | "http" | "file";
export declare function expandConfig(config: Config, preferHttp: boolean): ExpandedConfig;
