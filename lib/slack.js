var settings = require('./config/slack'),
    SlackBot = require('slackbots'),
    _ = require('lodash');

var bot = new SlackBot({
  token: settings.token,
  name: settings.name
});

var slackOpts = {
  'icon_url': settings.icon
};

exports.message = ( text, opts ) => {
  bot.postMessageToChannel(settings.channel, text, _.merge(slackOpts, opts || {}));
};
