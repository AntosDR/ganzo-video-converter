/*
 * Gulp module used for TypeScript compiling.
 */

const {src, dest, series} = require("gulp");
const clean = require("gulp-clean");
const ts = require("gulp-typescript");
const tsProject = ts.createProject("tsconfig.json");
const tsRendererProject = ts.createProject("tsconfig-renderer.json");
const { OUTPUT } = require("./constants");

/**
 * Compiles TypeScript for the node context modules.
 * Produces a CommonJS module for each ts file.
 * @returns The gulp stream.
 */
function transpileNodeContextModules() {
	return tsProject.src().pipe(tsProject()).js.pipe(dest(OUTPUT.DEVELOPMENT.CODE_DIR));
}

/**
 * Compiles TypeScript for the web context modules.
 * Produces a single all-in-one AMD module, as renderer.js, for each ts file under the "renderer" folder.
 * @returns The gulp stream.
 */
function transpileWebContextModules() {
	return tsRendererProject.src().pipe(tsRendererProject()).js.pipe(dest(OUTPUT.DEVELOPMENT.WEB_CODE_DIR));
}


/**
 * Deletes the TypeScript compiled code.
 * @returns The gulp stream.
 */
function cleanCode() {
	return src(OUTPUT.DEVELOPMENT.CODE, { read: false,  allowEmpty: true }).pipe(clean());
}

exports.transpileNodeContextModules = transpileNodeContextModules;
exports.transpileWebContextModules = transpileWebContextModules;
exports.transpileCode = series(transpileNodeContextModules, transpileWebContextModules);
exports.cleanCode = cleanCode;
