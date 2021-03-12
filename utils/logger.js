'use strict';
const config = require('config');
const { createLogger, format, transports } = require('winston');
const path = require('path');

const consoleLogFormat = format.combine(
    format.colorize(),
    format.label({ label: path.basename(process.mainModule.filename) }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(
        (info) =>
            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
    )
);

const consoleLogFormatNoColor = format.combine(
    format.label({ label: path.basename(process.mainModule.filename) }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(
        (info) =>
            `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
    )
);

const logger = createLogger({
    transports: [
        new transports.Console({
            format: config.get('logger.colorize')
                ? consoleLogFormat
                : consoleLogFormatNoColor,
            level: config.get('logger.level'),
            handleExceptions: true,
            json: false,
        }),
    ],
});

logger.stream = {
    write: function (message) {
        // Trim message to remove empty line
        logger.info(message.trim());
    },
};

module.exports = logger;
