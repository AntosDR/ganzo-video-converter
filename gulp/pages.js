/*
 * Gulp module used for HTML pages minifying.
 */

const gulp = require("gulp");
const clean = require("gulp-clean");
const htmlmin = require('gulp-htmlmin');
const less = require('gulp-less');
const { SOURCE, OUTPUT } = require("./constants");

/**
 * Minifies HTML pages.
 * @returns The gulp stream.
 */
function minifyPages() {
	return gulp.src(SOURCE.PAGES)
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(gulp.dest(OUTPUT.DEVELOPMENT.PAGES));
}

/**
 * Clears all minified HTML pages.
 * @returns The gulp stream.
 */
function cleanPages() {
	return gulp.src(OUTPUT.DEVELOPMENT.PAGES, { read: false, allowEmpty: true }).pipe(clean());
}

/**
 * Compile less styles.
 * @returns The gulp stream.
 */
function compileLess() {
	return gulp.src(SOURCE.STYLES)
		.pipe(less())
		.pipe(gulp.dest(OUTPUT.DEVELOPMENT.STYLES));
}

/**
 * Clears all compiled styles.
 * @returns The gulp stream.
 */
function cleanStyles() {
	return gulp.src(OUTPUT.DEVELOPMENT.STYLES, { read: false, allowEmpty: true }).pipe(clean());
}

exports.minifyPages = minifyPages;
exports.cleanPages = cleanPages;
exports.compileLess = compileLess;
exports.cleanStyles = cleanStyles;
