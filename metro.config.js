const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .mjs files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Add module resolution for problematic packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle generator-function module resolution issue
  if (moduleName === 'generator-function') {
    return {
      filePath: require.resolve('generator-function'),
      type: 'sourceFile',
    };
  }
  
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
