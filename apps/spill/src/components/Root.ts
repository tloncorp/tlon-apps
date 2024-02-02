const appEnv = process.env.APP_ENV;

export default appEnv === 'cosmos'
  ? require('./Cosmos').default
  : require('./App').default;
