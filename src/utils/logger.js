import config from 'config';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

export default (fileUrl) => {
    const getModule = function (fileUrl) {
        let moduleName;
        try {
            const file = fileURLToPath(new URL(fileUrl));
            const fileSplit = file.split(/[/\\]/);
            moduleName = fileSplit[fileSplit.length - 1];
        } catch {
            moduleName = '';
        }
        return moduleName;
    };

    const consoleLogFormat = format.combine(
        format.colorize(),
        format.label({ label: getModule(fileUrl) }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            (info) =>
                `${info.timestamp} ${info.level} [${getModule(info.fileUrl) || info.label}]: ${info.message}`,
        ),
    );

    const consoleLogFormatNoColor = format.combine(
        format.label({ label: getModule(fileUrl) }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            (info) =>
                `${info.timestamp} ${info.level} [${getModule(info.fileUrl) || info.label}]: ${info.message}`,
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
