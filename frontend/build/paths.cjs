const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
module.exports = {
  projectRoot,
  sourceRoot: path.join(projectRoot, 'src'),
  packageRoot: path.resolve(projectRoot, '..', 'package')
};
