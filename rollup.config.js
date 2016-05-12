import json from 'rollup-plugin-json';

export default {
	entry: './src/main.js',
	plugins: [ json() ],
	dest: './dist/rn.js'
}