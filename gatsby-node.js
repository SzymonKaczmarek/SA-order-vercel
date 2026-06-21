const fs = require('fs');
const path = require('path');

const MODE_FILE = path.join(__dirname, '.gatsby-last-mode');
const DEV_404_ALIAS = '../../dev-404-page.js';

function writeLastMode(mode) {
  fs.writeFileSync(MODE_FILE, mode, 'utf8');
}

/**
 * Gatsby generuje import dev-404-page w virtual FS ($virtual/async-requires.js).
 * Po mieszanym build + develop webpack czasem nie rozwiązuje ścieżki względnej — alias naprawia to.
 */
exports.onCreateWebpackConfig = ({ actions, stage }) => {
  if (stage !== 'develop' && stage !== 'develop-html') {
    return;
  }

  const dev404Page = path.resolve(__dirname, '.cache/dev-404-page.js');

  actions.setWebpackConfig({
    resolve: {
      alias: {
        [DEV_404_ALIAS]: dev404Page,
      },
    },
  });
};

exports.onPreBootstrap = () => {
  writeLastMode('develop');
};

exports.onPostBuild = () => {
  writeLastMode('build');
};
