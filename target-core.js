process.title = 'Slated Target - Node.js';

var express    = require('express'),
    winston    = require('./lib/winston')(),
    chalk      = require('chalk'),
    bodyParser = require('body-parser'),
    morgan     = require('morgan'),
    app        = express();

var handler = require('./lib/target'),
    port    = process.env.PORT || 4544;

winston.debug(chalk.dim('Setting server options...'));
app.disable('x-powered-by');
winston.debug(chalk.dim('Setting up middleware...'));

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.post('/deploy', handler.deploy);

app.listen(port, function () {
  winston.info(chalk.dim('Slated listening on port:', port));
});
