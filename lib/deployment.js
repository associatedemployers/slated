var winston = require('winston'),
    request = require('request'),
    Promise = require('bluebird'),
    keygen = require('keygenerator'),
    redis = require('redis'),
    _ = require('lodash'),
    slack = require('./slack').message,
    manifest = require('../config/manifest');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var db = redis.createClient(),
    dbRefreshResolution = 1000;

module.exports = function ( event ) {
  var payload = event.payload;

  winston.debug('Received a push event for %s to %s',
    event.payload.repository.name,
    event.payload.ref);

  var ref = payload.ref.split('/').pop(),
      repository = payload.repository.name;
  console.log(ref, repository);
  console.log(manifest);

  var appInManifest = _.find(manifest, { ref, repository });

  if ( !appInManifest ) {
    return winston.debug('No app found for event');
  }

  var deploymentId = keygen._({ length: 10 }),
      redisKey = repository + '_d' + deploymentId;

  winston.debug('Found deployment manifest for push event.\n', appInManifest);
  winston.debug('Beginning rolling deployment:, "' + deploymentId + '"...');
  slack('Overseeing a rolling deployment to ' + appInManifest.targets.length + ' targets of ' + event.payload.repository.name + '. Standby for updates...');

  var targetDefinitions = appInManifest.targets.reduce((definition, t) => {
    definition[t] = false;
    return definition;
  }, {});

  winston.debug(targetDefinitions);

  db.hmsetAsync(redisKey, targetDefinitions)
  .then(() => {
    winston.debug('set redis target definitions');
    return Promise.reduce(appInManifest.targets, (completed, target) => {
      winston.debug('reducing on target', target);
      return new Promise((resolve, reject) => {
        slack('Notifying target @ ' + target + ' of deployment role. Awaiting response and action...');
        winston.debug('notifying target', target);
        request.post({
          url: 'http://' + target + ':' + (appInManifest.targetPort || '4544') + '/deploy',
          form: {
            ref,
            deploymentId,
            fullDeploymentKey: redisKey,
            clonePath: payload.repository.clone_url,
            repo: payload.repository.name
          }
        }, ( err, httpResponse ) => {
          if ( err ) {
            winston.debug('error notifying target', target, err);
            return reject(err);
          }

          if ( httpResponse.statusCode !== 200 ) {
            winston.debug('failed to notify target', target, httpResponse.body);
            return reject(err);
          }

          var checkDb = () => {
            winston.debug('Checking db for update');

            db.hgetAsync(redisKey, 'buildFailure')
            .then(failure => {
              if ( failure ) {
                return db.hgetAsync(redisKey, 'buildError')
                .then(err => {
                  reject(err);
                });
              }

              db.hgetAsync(redisKey, target)
              .then(value => {
                if ( value === false ) {
                  setTimeout(checkDb, dbRefreshResolution);
                } else {
                  slack('Target @ ' + target + ' completed it\'s deployment.');
                  winston.debug('Target [', target, '] completed deploying.');
                  completed.push(target);
                  resolve(target);
                }
              });
            });
          };

          setTimeout(checkDb, dbRefreshResolution);
        });
      });
    }, []);
  })
  .then(() => {
    // TODO: Slack log
    winston.debug('Done deploying ', repository);
  })
  .catch(err => {
    winston.error(err);
    slack('Rolling deployment failed! Sorry! Error was: ' + err);
  });
};
