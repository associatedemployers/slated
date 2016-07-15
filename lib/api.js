var deploymentHandler = require('./deployment'),
    GithubWebhookHandler = require('koa-github-webhook-handler').default;

module.exports = function (router, app) {
  var githubWebhookHandler = new GithubWebhookHandler({
    path: '/gh-webhook',
    secret: require('../config/server.json').githubSecret || process.env.GITHUB
  });

  githubWebhookHandler.on('push', deploymentHandler);

  // app.use(bodyParser());
  app.use(githubWebhookHandler.middleware());
  router.get('/notify/deployment-complete/:key', require('./routes/target-deployment-complete'));
  router.post('/notify/deployment-error/:key', require('./routes/target-deployment-error'));
};
