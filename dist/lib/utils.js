'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.injectPackage = injectPackage;
exports.deploy = deploy;
exports.cleanup = cleanup;
exports.copyContents = copyContents;

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _child_process = require('child_process');

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _walk = require('walk');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Packages
// Native
function injectPackage(tmpDir, defaults, flags) {
  const pkgPath = _path2.default.join(tmpDir, 'package.json');

  _fsExtra2.default.writeJSON(pkgPath, defaults, err => {
    if (err) {
      throw err;
    }

    exports.deploy(tmpDir, flags);
  });
}

function deploy(dir, flags) {
  const oldCwd = process.cwd();
  const cmd = process.platform === 'win32' ? 'now.cmd' : 'now';

  process.chdir(dir);
  const flagsAllowed = typeof flags === 'string';
  const flagList = [];

  if (flagsAllowed) {
    let splitted = flags.split(', ');

    for (const item of splitted) {
      if (item.indexOf(',') > -1) {
        splitted = flags.split(',');
        break;
      }
    }

    for (const item of splitted) {
      flagList.push(item);
    }
  }

  for (const flag of flagList) {
    const index = flagList.indexOf(flag);
    const prefix = flag.length > 1 ? '--' : '-';

    if (flag === '') {
      flagList.splice(index, 1);
    } else {
      flagList[index] = prefix + flag;
    }
  }

  // Run now and deploy
  const now = (0, _child_process.spawn)(cmd, flagList, {
    stdio: 'inherit'
  });

  now.on('error', err => console.error(err));

  now.on('exit', () => {
    process.chdir(oldCwd);
    exports.cleanup(dir);
  });

  process.on('SIGINT', () => {
    now.kill('SIGINT');
    exports.cleanup(dir);
  });
}

function cleanup(dir) {
  _fsExtra2.default.remove(dir, err => {
    if (err) {
      throw err;
    }

    process.exit();
  });
}

function copyContents(content, tmp, defaults, flags) {
  // Ignore packages
  const walker = (0, _walk.walk)(content, {
    filters: ['node_modules']
  });

  walker.on('file', (root, fileStats, next) => {
    const file = _path2.default.join(root, fileStats.name);
    const target = _path2.default.join(tmp + '/content', _path2.default.relative(content, file));

    // Once a file is found, copy it to the temp directory
    _fsExtra2.default.copy(file, target, err => {
      if (err) {
        throw err;
      }

      next();
    });
  });

  walker.on('errors', (root, nodeStatsArray, next) => {
    console.error(`Not able to copy file: ${ nodeStatsArray }`);
    next();
  });

  walker.on('end', () => exports.injectPackage(tmp, defaults, flags));
}