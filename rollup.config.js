import json from 'rollup-plugin-json';

export default {
	entry: './src/main.js',
	plugins: [
		json(),
	],
	sourceMap: true,
	dest: './dist/rn.js'
}
