module.exports = {
	root: true,
	extends: [
		'mitmaro',
		'mitmaro/config/ecmascript-7',
		'mitmaro/config/node',
	],
	rules: {
		'node/no-unsupported-features': 'off',
	}
};
