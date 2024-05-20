import config from 'config';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

export default (meta_url) => {
    let filename = '';
    if (meta_url) {
        const file = fileURLToPath(new URL(meta_url));
        const fileSplit = file.split(/[/\\]/);
        filename = fileSplit[fileSplit.length - 1];
    }

    const consoleLogFormat = format.combine(
        format.colorize(),
        format.label({ label: filename }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            (info) =>
                `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`,
        ),
    );

    const consoleLogFormatNoColor = format.combine(
        format.label({ label: filename }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            (info) =>
                `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`,
        ),
    );

    const loggerInstance = createLogger({
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

    loggerInstance.stream = {
        write: function (message) {
            // Trim message to remove empty line
            loggerInstance.info(message.trim());
        },
    };

    return loggerInstance;
};
