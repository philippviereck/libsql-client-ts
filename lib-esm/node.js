import { LibsqlError } from "./api.js";
import { expandConfig } from "./config.js";
import { _createClient as _createWsClient } from "./ws.js";
import { _createClient as _createHttpClient } from "./http.js";
export * from "./api.js";
/** Creates a {@link Client} object.
 *
 * You must pass at least an `url` in the {@link Config} object.
 */
export function createClient(config) {
    return _createClient(expandConfig(config, true));
}
function _createClient(config) {
    if (config.scheme === "wss" || config.scheme === "ws") {
        return _createWsClient(config);
    }
    else if (config.scheme === "https" || config.scheme === "http") {
        return _createHttpClient(config);
    }
    else {
        throw new LibsqlError("This build does not support local libsql files", "URL_SCHEME_NOT_SUPPORTED");
    }
}
