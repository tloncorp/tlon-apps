module.exports = (global as any).__DEV__
  ? require('./App.cosmos')
  : require('./App.main');
