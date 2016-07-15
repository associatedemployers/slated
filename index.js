
/**
 * Module dependencies.
 */

var responseTime = require('koa-response-time'),
    bodyParser   = require('koa-bodyparser'),
    ratelimit    = require('koa-ratelimit'),
    compress     = require('koa-compress'),
    winston      = require('winston'),
    logger       = require('koa-logger'),
    router       = require('koa-router')(),
    apiRoutes    = require('./lib/api'),
    redis        = require('redis'),
    koa          = require('koa');

/**
 * Environment.
 */

const env = process.env.NODE_ENV || 'development';

/**
 * Initialize an app with the given `opts`.
 *
 * @param {Object} opts
 * @return {Application}
 * @api public
 */

module.exports = function api (opts) {
  let _opts = opts || {},
      app = koa();

  // logging
  if ( env !== 'test' ) {
    app.use(logger());
  }

  // request body parsing
  app.use(bodyParser());
  app.use(function*( next ) {
    this.body = this.request.body;
    yield next;
  });

  // x-response-time
  app.use(responseTime());

  // compression
  app.use(compress());

  // rate limiting
  app.use(ratelimit({
    max: _opts.ratelimit,
    duration: _opts.duration,
    db: redis.createClient()
  }));

  if ( process.env.NODE_ENV === 'test' ) {
    app.use(function *(next) {
      try {
        yield next;
      } catch (err) {
        this.status = err.status || 500;
        if ( this.status > 499 ) {
          winston.error(err);
        }
        this.body = err.message;
        this.app.emit('error', err, this);
      }
    });
  }

  apiRoutes(router, app);

  app.use(router.routes())
     .use(router.allowedMethods());

  return app;
};
