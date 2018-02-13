const config = require('../config.js');
const db = require('knex')(config.database);
const bcrypt = require('bcrypt');
const randomstring = require('randomstring');
const utils = require('./utilsController.js');

let authController = {};

authController.verify = async (req, res, next) => {
	const username = req.body.username;
	const password = req.body.password;

	if (username === undefined) return next({ status: 401, message: 'No username provided' });
	if (password === undefined) return next({ status: 401, message: 'No password provided' });

	const user = await db.table('users').where('username', username).first();
	if (!user) return next({ status: 401, message: 'Invalid username or password' });
	if (user.disabled) return next({ status: 401, message: 'You have been banned from this service' });
	bcrypt.compare(password, user.password, (err, result) => {
		if (err) {
			console.log(err);
			return next({ status: 401, message: 'There was an error' });
		}
		if (result === false) return next({ status: 401, message: 'Invalid username or password' });
		return res.json({ success: true, token: user.token });
	});
};

authController.register = async (req, res, next) => {
	if (config.enableUserAccounts === false) {
		return next({ status: 401, message: 'Register is disabled at the moment' });
	}

	await authController._addUser(req, res, next);
}

authController.changePassword = async (req, res, next) => {
	const user = await utils.authorize(req, res, next);

	let password = req.body.password;
	if (password === undefined) return next({ status: 401, message: 'No password provided' });

	if (password.length < 6 || password.length > 64) {
		return next({ status: 401, message: 'Password must have 6-64 characters' });
	}

	bcrypt.hash(password, 10, async (err, hash) => {
		if (err) {
			console.log(err);
			return next({ status: 401, message: 'Error generating password hash (╯°□°）╯︵ ┻━┻' });
		}

		await db.table('users').where('id', user.id).update({ password: hash });
		return res.json({ success: true });
	});
};


authController._addUser = async (req, res, next) => {
	const username = req.body.username;
	const password = req.body.password;

	if (username === undefined) return next({ status: 401, message: 'No username provided' });
	if (password === undefined) return next({ status: 401, message: 'No password provided' });

	if (username.length < 3 || username.length > 32) {
		return next({ status: 401, message: 'Username must have 3-32 characters' })
	}
	if (password.length < 6 || password.length > 64) {
		return next({ status: 401, message: 'Password must have 6-64 characters' })
	}

	const user = await db.table('users').where('username', username).first();
	if (user) return next({ status: 401, message: 'Username already exists' });

	bcrypt.hash(password, 10, async (err, hash) => {
		if (err) {
			console.log(err);
			return next({ status: 401, message: 'Error generating password hash (╯°□°）╯︵ ┻━┻' });
		}
		const token = randomstring.generate(64);
		await db.table('users').insert({
			username: username,
			password: hash,
			token: token,
			timestamp: Math.floor(Date.now() / 1000),
			admin: 0,
			disabled: 0
		});
		return res.json({ success: true, token: token })
	});
};

module.exports = authController;
