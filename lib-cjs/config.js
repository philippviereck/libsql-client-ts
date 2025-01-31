"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandConfig = void 0;
const api_js_1 = require("./api.js");
const uri_js_1 = require("./uri.js");
const util_js_1 = require("./util.js");
function expandConfig(config, preferHttp) {
    if (typeof config !== "object") {
        // produce a reasonable error message in the common case where users type
        // `createClient("libsql://...")` instead of `createClient({url: "libsql://..."})`
        throw new TypeError(`Expected client configuration as object, got ${typeof config}`);
    }
    const uri = (0, uri_js_1.parseUri)(config.url);
    let tls = config.tls;
    let authToken = config.authToken;
    for (const { key, value } of uri.query?.pairs ?? []) {
        if (key === "authToken") {
            authToken = value ? value : undefined;
        }
        else if (key === "tls") {
            if (value === "0") {
                tls = false;
            }
            else if (value === "1") {
                tls = true;
            }
            else {
                throw new api_js_1.LibsqlError(`Unknown value for the "tls" query argument: ${JSON.stringify(value)}. ` +
                    'Supported values are "0" and "1"', "URL_INVALID");
            }
        }
        else {
            throw new api_js_1.LibsqlError(`Unknown URL query parameter ${JSON.stringify(key)}`, "URL_PARAM_NOT_SUPPORTED");
        }
    }
    let syncUrl = config.syncUrl;
    const uriScheme = uri.scheme.toLowerCase();
    let scheme;
    if (uriScheme === "libsql") {
        if (tls === false) {
            if (uri.authority?.port === undefined) {
                throw new api_js_1.LibsqlError('A "libsql:" URL with ?tls=0 must specify an explicit port', "URL_INVALID");
            }
            scheme = preferHttp ? "http" : "ws";
        }
        else {
            scheme = preferHttp ? "https" : "wss";
        }
    }
    else if (uriScheme === "http" || uriScheme === "ws") {
        scheme = uriScheme;
        tls ??= false;
    }
    else if (uriScheme === "https" || uriScheme === "wss" || uriScheme === "file") {
        scheme = uriScheme;
    }
    else {
        throw new api_js_1.LibsqlError('The client supports only "libsql:", "wss:", "ws:", "https:", "http:" and "file:" URLs, ' +
            `got ${JSON.stringify(uri.scheme + ":")}. ` +
            `For more information, please read ${util_js_1.supportedUrlLink}`, "URL_SCHEME_NOT_SUPPORTED");
    }
    if (uri.fragment !== undefined) {
        throw new api_js_1.LibsqlError(`URL fragments are not supported: ${JSON.stringify("#" + uri.fragment)}`, "URL_INVALID");
    }
    const intMode = "" + (config.intMode ?? "number");
    if (intMode !== "number" && intMode !== "bigint" && intMode !== "string") {
        throw new TypeError(`Invalid value for intMode, expected "number", "bigint" or "string", \
            got ${JSON.stringify(intMode)}`);
    }
    return {
        scheme,
        tls: tls ?? true,
        authority: uri.authority,
        path: uri.path,
        authToken,
        syncUrl,
        intMode,
        fetch: config.fetch,
    };
}
exports.expandConfig = expandConfig;
