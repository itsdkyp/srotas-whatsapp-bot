const fs = require('fs');
const path = require('path');
module.exports = function(app) {
    const logPath = path.join(app.getPath('userData'), 'crash-debug.log');
    return function(msg) {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    };
};
