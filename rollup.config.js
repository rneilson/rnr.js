import json from 'rollup-plugin-json';

export default {
	entry: './src/main.js',
	plugins: [
		json(),
	],
	sourceMap: true,
	moduleName: 'rnr'
}
