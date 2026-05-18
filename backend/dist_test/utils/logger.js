"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
let logger;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../config/logger');
    logger = mod.logger;
}
catch {
    // Fallback for environments without pino (e.g., tests)
    logger = {
        error: (obj) => console.error(obj?.msg ?? obj),
        warn: (obj) => console.warn(obj?.msg ?? obj),
        info: (obj) => console.log(obj?.msg ?? obj),
        debug: () => { },
    };
}
exports.default = logger;
//# sourceMappingURL=logger.js.map