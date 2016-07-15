var redis = require('redis'),
    Promise = require('bluebird');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var db = redis.createClient();

module.exports = function*() {
  var redisKey = this.params.key,
      error = this.body.error;

  if ( !(yield db.existsAsync(redisKey)) ) {
    this.status = 404;
    this.body = 'Invalid deployment.';
    return;
  }

  yield db.hsetAsync(redisKey, 'buildFailure', this.request.ip);
  yield db.hsetAsync(redisKey, 'buildError', error);

  this.status = 200;
  return;
};
