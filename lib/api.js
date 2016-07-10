var route = require('koa-route'),
    deploymentHandler = require('./deployment'),
    GithubWebhookHandler = require('koa-github-webhook-handler').default;

module.exports = function (app) {
  var githubWebhookHandler = new GithubWebhookHandler({
    path: '/gh-webhook',
    secret: require('../config/server.json').githubSecret || process.env.GITHUB
  });

  githubWebhookHandler.on('push', deploymentHandler);

  app.use(githubWebhookHandler.middleware());
  app.use(route.get('/notify/deployment-complete/:key', require('./routes/target-deployment-complete')));
  app.use(route.post('/notify/deployment-error/:key', require('./routes/target-deployment-error')));
};
