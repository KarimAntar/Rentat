const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .mjs files
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// Add Node.js polyfills for web platform
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
};

// Add module resolution for problematic packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle generator-function module resolution issue
  if (moduleName === 'generator-function') {
    return {
      filePath: require.resolve('generator-function'),
      type: 'sourceFile',
    };
  }
  
  // Polyfill Node.js core modules for web
  if (platform === 'web' && moduleName === 'stream') {
    return {
      filePath: require.resolve('stream-browserify'),
      type: 'sourceFile',
    };
  }
  
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
