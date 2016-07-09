var redis = require('redis'),
    Promise = require('bluebird');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var db = redis.createClient();

module.exports = function*() {
  var redisKey = this.request.params.key;

  if ( yield !db.hexistsAsync(redisKey) ) {
    this.status = 404;
    this.body = 'Invalid deployment.';
    return;
  }

  yield db.hsetAsync(redisKey, this.request.ip, true);
  this.status = 200;
  return;
};
