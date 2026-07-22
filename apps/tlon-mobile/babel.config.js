module.exports = function (api) {
  // The mobile fast loop may skip the expensive whole-app compilers during
  // iteration. Normal builds and final validation keep both enabled.
  const reactCompilerEnvironment = api.caller((caller) => {
    if (
      process.env.TLON_REACT_COMPILER_DISABLED === '1' ||
      !caller?.supportsReactCompiler ||
      caller.isNodeModule ||
      caller.isServer ||
      caller.isReactServer
    ) {
      return 'disabled';
    }
    return caller.isDev === false ? 'production' : 'development';
  });
  const disableTamaguiCompiler =
    process.env.TLON_TAMAGUI_COMPILER_DISABLED === '1';

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
      !disableTamaguiCompiler && [
        '@tamagui/babel-plugin',
        {
          config: './tamagui.config.ts',
          components: ['@tloncorp/ui', 'tamagui'],
          experimentalFlattenThemesOnNative: true,
        },
      ],
      'react-native-worklets/plugin',
    ].filter(Boolean),
  };
};
