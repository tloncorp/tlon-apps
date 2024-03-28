// @ts-expect-error  this is fine, it does exist
module.exports = global.__DEV__
  ? require('./App.cosmos')
  : require('./App.main');
