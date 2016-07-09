var winston = require('winston'),
    request = require(''),
    Promise = require('bluebird'),
    keygen = require('key-generator'),
    redis = require('redis'),
    _ = require('lodash'),
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
      repository = payload.repository.name,
      appInManifest = _.find(manifest, { ref, repository });

  if ( !appInManifest ) {
    return winston.debug('No app found for event');
  }

  var deploymentId = keygen._({ length: 10 }),
      redisKey = repository + '_d' + deploymentId;

  winston.debug('Found deployment manifest for push event.\n', appInManifest);
  winston.debug('Beginning rolling deployment:, "' + deploymentId + '"...');

  var targetDefinitions = appInManifest.targets.reduce((definition, t) => {
    definition[t] = false;
    return definition;
  }, {});

  db.hmsetAsync(redisKey, targetDefinitions)
  .then(() => {
    return Promise.reduce(appInManifest.targets, (completed, target) => {
      return new Promise((resolve, reject) => {
        request
        .post({
          url: 'http://' + target + ':' + appInManifest.targetPort || '4544/deploy',
          form: {
            ref,
            deploymentId,
            fullDeploymentKey: redisKey,
            clonePath: payload.repository.clone_url,
            repo: payload.repository.name
          }
        }, ( err ) => {
          if ( err ) {
            return reject(err);
          }

          var checkDb = () => {
            db.hgetAsync(redisKey, target)
            .then(value => {
              if ( value === false ) {
                setTimeout(checkDb, dbRefreshResolution);
              } else {
                winston.debug('Target [', target, '] completed deploying.');
                completed.push(target);
                resolve(target);
              }
            });
          };

          setTimeout(checkDb, dbRefreshResolution);
        });
      });
    }, []);
  })
  .then(() => {
    winston.debug('Done deploying ', repository);
  })
};
