/**
 * Build toolkit constants.
 */

const SOURCE = {
	DIR: "./src",
	PAGES: "./src/pages/*.html",
	STYLES: "./src/styles/*.less"
};

const OUTPUT = {
	DEVELOPMENT: {
		DIR: "./build",
		CODE_DIR: "./build/js",
		WEB_CODE_DIR: "./build/js/renderer/",
		CODE: "./build/js/**/*.js",
		PAGES: "./build/pages",
		STYLES: "./build/styles"
	},
	RELEASE: {
		DIR: "./dist"
	}
};

exports.SOURCE = SOURCE;
exports.OUTPUT = OUTPUT;
