/* Target Handler */

var winston      = require('winston'),
    Promise      = require('bluebird'),
    exec         = require('child_process').exec,
    request      = require('request'),
    ipAddress    = require('ipaddr.js'),
    targetConfig = require('../config/target.json'),
    manifest     = targetConfig.repos,
    slatedIp     = process.env.SLATED_IP || targetConfig.slatedIp,
    slatedPort   = process.env.SLATED_PORT || targetConfig.slatedPort || 4000,
    slatedHost   = 'http://' + slatedIp + ':' + slatedPort + '/',
    slack        = require('./slack'),
    _            = require('lodash');

function cloneTarget ( target ) {
  return new Promise((resolve, reject) => {
    winston.debug('Cloning target...');

    var _path = target.clonePath,
        ref = this.ref,
        onBranch = ref && ref !== 'master' ? ref : false,
        branchSegment = onBranch ? ' -b ' + onBranch + ' --single-branch ' : '',
        cloneCmd = 'cd && mkdir -p ' + _path + ' && cd ' + _path + ' && git clone ' + branchSegment + this.clonePath;

    winston.debug('Running clone cmd:', cloneCmd);

    exec(cloneCmd, (error) => {
      if ( error ) {
        console.log('throwing', error);
        slack.message(':grimacing: Whoops... I had trouble cloning ' + this.repo + '.\nERR:' + error || stderr);
        return reject(error);
      }

      slack.message(':ok_hand: I\'ve cloned ' + this.repo + '. Running build commands...');
      winston.debug('Cloned target.');

      resolve(_path);
    });
  });
}

function runCommands ( target ) {
  winston.log('debug', 'Running target commands...');

  if ( !target.commands || target.commands.length < 1 ) {
    winston.log('debug', 'No commands ran.');
    return Promise.resolve();
  }

  var _runCmd = (ret, command, i, l) => {
    return new Promise((resolve, reject) => {
      winston.log('debug', 'Running command:', command);
      exec(command, (error, stdout) => {
        if ( error ) {
          slack.message(':grimacing: I had trouble running a command for ' + this.repo + '.\nThe command was: ' + command + '\nERR:' + error);
          return reject(error);
        }

        slack.message(':heavy_check_mark: [' + this.repo + '] Successfully ran build command ' + (i + 1) + ' of ' + l + '.');

        winston.log('debug', stdout);

        ret.push(command);
        resolve(ret);
      });
    });
  };

  return Promise.reduce(target.commands, _runCmd, [])
  .then(commands => {
    winston.log('debug', 'Ran', commands.length, 'commands.');
  });
}

exports.deploy = function ( req, res ) {
  var payload = req.body;

  winston.log('debug', 'Got request for push action');

  if ( !_.isEqual(ipAddress.process(slatedIp), ipAddress.process(req.ip)) ) {
    return res.status(401).send('Unauthorized request for deployment: unrecognized IP');
  }

  var target = manifest[req.body.repo];

  if ( !target ) {
    return res.status(400).send('Unable to find manifest for repo.');
  }

  res.status(200).end();
  slack.message('Beginning deployment of ' + payload.repo + '. [' + payload.deploymentId + ']');

  cloneTarget.call(payload, target).then(() => {
    return runCommands.call(payload, target);
  }).then(() => {
    winston.debug('Notifying slated host', slatedHost);
    slack.message(':punch: Fist bump! Just deployed a new version of ' + payload.repo + '.');
    request.get(slatedHost + 'notify/deployment-complete/' + payload.fullDeploymentKey);
  }).catch(err => {
    var error = JSON.stringify(err);
    winston.error(err);
    request.post(slatedHost + 'notify/deployment-error/' + payload.fullDeploymentKey, { form: { error } });
  });
};
