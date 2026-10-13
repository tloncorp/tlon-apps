module.exports = function (api) {
  const reactCompilerEnvironment = api.caller((caller) => {
    if (
      !caller?.supportsReactCompiler ||
      caller.isNodeModule ||
      caller.isServer ||
      caller.isReactServer
    ) {
      return 'disabled';
    }
    return caller.isDev === false ? 'production' : 'development';
  });
  const platform = api.caller((caller) => caller?.platform);

  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
          // The compiler is configured first below so it sees original source.
          'react-compiler': false,
        },
      ],
    ],
    plugins: [
      reactCompilerEnvironment !== 'disabled' && [
        'babel-plugin-react-compiler',
        {
          target: '19',
          environment: {
            enableResetCacheOnSourceFileChanges:
              reactCompilerEnvironment !== 'production',
          },
          panicThreshold:
            reactCompilerEnvironment === 'production' ? 'none' : undefined,
          customOptOutDirectives: ['widget', 'use no memo', 'use no forget'],
        },
      ],
      // Allow sql imports so that we can bundle drizzle migrations.
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
      [
        '@tamagui/babel-plugin',
        {
          config: './tamagui.config.ts',
          components: ['@tloncorp/ui', 'tamagui'],
          experimentalFlattenThemesOnNative: true,
        },
      ],
      // The Tamagui compiler can't tell Android from iOS, so it bakes iOS text
      // trims and font families into flattened text; this swaps in Android's.
      platform === 'android' &&
        require.resolve('@tloncorp/ui/babel/android-text-styles'),
      'react-native-worklets/plugin',
    ].filter(Boolean),
  };
};
