
const transpile = require("./gulp/transpile.js");
const clean = require("gulp-clean");
const pages = require("./gulp/pages.js");
const { parallel, src } = require("gulp");
const { OUTPUT } = require("./gulp/constants");


/**
 * Clears all build stuff.
 * @returns The gulp stream.
 */
function cleanBuild() {
	return src(OUTPUT.DEVELOPMENT.DIR, { read: false, allowEmpty: true }).pipe(clean());
}

/**
 * Clears all release executables and packages.
 * @returns The gulp stream.
 */
function cleanDist() {
	return src(OUTPUT.RELEASE.DIR, { read: false, allowEmpty: true }).pipe(clean());
}

exports.transpile = transpile.transpileCode;
exports.transpileNodeContextModules = transpile.transpileNodeContextModules;
exports.transpileWebContextModules = transpile.transpileWebContextModules;
exports.clean = cleanBuild;
exports.cleanDist = cleanDist;
exports.pages = pages.minifyPages;
exports.compileLess = pages.compileLess;
exports.buildAll = parallel(transpile.transpileCode, pages.minifyPages, pages.compileLess);
exports.default = exports.buildAll;