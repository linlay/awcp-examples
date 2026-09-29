const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {
  projectRoot,
  sourceRoot,
  packageRoot
} = require('./build/paths.cjs');

module.exports = (_env, argv) => {
  const development = argv.mode !== 'production';
  const typescriptRule = (test, tsx) => ({
    test,
    include: [sourceRoot, packageRoot],
    use: {
      loader: 'swc-loader',
      options: {
        jsc: {
          target: 'es2020',
          parser: { syntax: 'typescript', tsx, decorators: true },
          transform: { react: { runtime: 'automatic', development } }
        }
      }
    }
  });

  return {
    context: projectRoot,
    target: ['web', 'es2020'],
    entry: path.join(sourceRoot, 'main.tsx'),
    mode: development ? 'development' : 'production',
    devtool: development ? 'eval-cheap-module-source-map' : 'source-map',
    cache: false,
    output: {
      path: path.join(projectRoot, 'dist'),
      filename: 'assets/[name].[contenthash:8].js',
      publicPath: '/',
      clean: true
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@app/awcp$': path.join(packageRoot, 'awcp/index.ts'),
        '@app/ui$': path.join(packageRoot, 'ui/index.ts'),
        react: path.dirname(require.resolve('react/package.json')),
        'react-dom': path.dirname(require.resolve('react-dom/package.json'))
      }
    },
    module: {
      rules: [
        typescriptRule(/\.ts$/, false),
        typescriptRule(/\.tsx$/, true),
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: { modules: { auto: /\.module\.css$/i } }
            }
          ]
        },
        { test: /\.(png|jpe?g|svg|woff2?)$/i, type: 'asset/resource' }
      ]
    },
    plugins: [new HtmlWebpackPlugin({ template: path.join(projectRoot, 'public/index.html') })],
    devServer: {
      host: '127.0.0.1',
      port: 2180,
      open: false,
      hot: true,
      historyApiFallback: true,
      static: { directory: path.join(projectRoot, 'public') },
      client: { overlay: true }
    }
  };
};
