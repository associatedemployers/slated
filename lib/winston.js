const winston = require('winston'),
      ENV = process.env.NODE_ENV,
      devEnv = ENV === 'dev' || ENV === 'development';

module.exports = function () {
  winston.setLevels({
    trace: 9,
    input: 8,
    verbose: 7,
    prompt: 6,
    debug: 5,
    info: 4,
    data: 3,
    help: 2,
    warn: 1,
    error: 0
  });

  winston.addColors({
    trace: 'magenta',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    debug: 'dim',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    error: 'red'
  });

  winston.remove(winston.transports.Console);
  winston.add(winston.transports.Console, {
    level: process.env.logLevel || ENV === 'test' ? 'warn' : devEnv ? 'debug' : 'info',
    prettyPrint: true,
    colorize: true,
    silent: false,
    timestamp: false
  });

  winston.level = process.env.logLevel || ENV === 'test' ? 'warn' : devEnv ? 'debug' : 'info';

  return winston;
};
