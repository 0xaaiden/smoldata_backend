
import pkg from 'winston';
const { createLogger, transports, format } = pkg;
const myFormat = format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`);

export default createLogger({
  transports: [
    new transports.Console(),
  ],
  format: format.combine(
    format.timestamp(),
    myFormat,
  ),
});
