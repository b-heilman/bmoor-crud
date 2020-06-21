
const gulp = require('gulp');
const methods = require('bmoor-gulp');

methods.config.assign({
	test: {
		bootstrap: null,
		files: [
			'./src/*.spec.js',
			'./src/**/*.spec.js'
		]
	},
	lint: {
		files: [
			'./src/*.js',
			'./src/**/*.js'
		]
	},
	docs: {
		bootstrap: './README.md',
		files: [
			'./src/*.js',
			'./src/**/*.js'
		],
		output: './docs'
	}
});

gulp.task('lint', methods.lint);
gulp.task('test', gulp.series(methods.test, methods.lint));
gulp.task('docs', methods.docs);
