const config = require('../config.js');
const db = require('knex')(config.database);
const randomstring = require('randomstring');
const utils = require('./utilsController.js');

const tokenController = {};

tokenController.verify = async (req, res, next) => {
	const token = req.body.token;
	if (token === undefined) return next({ status: 401, message: 'No token provided' });

	const user = await db.table('users').where('token', token).first();
	if (!user) return next({ status: 401, message: 'Invalid token' });
	return res.json({ success: true, username: user.username, admin: user.admin });
};

tokenController.list = async (req, res, next) => {
	const user = await utils.authorize(req, res, next);
	if(!user) return;
	return res.json({ success: true, token: user.token });
};

tokenController.change = async (req, res, next) => {
	const user = await utils.authorize(req, res, next);
	if(!user) return;
	const newtoken = randomstring.generate(64);

	await db.table('users').where('token', user.token).update({
		token: newtoken,
		timestamp: Math.floor(Date.now() / 1000)
	});

	res.json({ success: true, token: newtoken });
};

module.exports = tokenController;
