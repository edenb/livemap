'use strict';
const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.label({ label: path.basename(process.mainModule.filename) }),
        format.colorize(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
    )
  ),
  transports: [new transports.Console()]
});

logger.stream = {
    write: function(message, encoding) {
        logger.info(message.trim());
    }
};

module.exports = logger;