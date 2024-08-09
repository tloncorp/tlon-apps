const originalModule = jest.requireActual('react-native');

// originalModule.NativeModules.SettingsManager = {
//   settings: {
//     AppleLocale: 'en-US',
//     AppleLanguages: ['fr-FR', 'en-US'],
//   },
// };

// Object.defineProperty(originalModule, 'Settings', {
//   get: jest.fn(() => {
//     return { get: jest.fn(), set: jest.fn(), watchKeys: jest.fn() };
//   }),
// });
// originalModule.Settings = {
//   get: jest.fn(() => {
//     return { get: jest.fn(), set: jest.fn(), watchKeys: jest.fn() };
//   }),
// };

// jest.mock('react-native', () => {
//   const ReactNative = jest.requireActual('react-native');
//   return Object.defineProperty(ReactNative, 'Settings', {
//     get: jest.fn(() => {
//       return { get: jest.fn(), set: jest.fn(), watchKeys: jest.fn() };
//     }),
//   });
// });

// jest.mock('react-native', () => {
//   const ReactNative = jest.requireActual('react-native');
//   return Object.defineProperty(ReactNative, 'Settings', {
//     get: jest.fn(() => {
//       return { get: jest.fn(), set: jest.fn(), watchKeys: jest.fn() };
//     }),
//   });
// });

module.exports = originalModule;
