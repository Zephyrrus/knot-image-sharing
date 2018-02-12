const config = require('../config.js');
const db = require('knex')(config.database);
const bcrypt = require('bcrypt');
const randomstring = require('randomstring');
const utils = require('./utilsController.js');
const authCtrl = require('./authController.js')

let adminController = {};

adminController.getUsers = async (req, res, next) => {
    const user = await utils.authorizeAdmin(req, res);

    const fields = ['id', 'username', 'timestamp', 'admin', 'disabled'];

    const users = await db.table('users').select(fields);

    for(let user of users) {
        user.date = new Date(user.timestamp * 1000);
		user.date = utils.getPrettyDate(user.date);
    }

    return res.json({ success: true, users });
}

adminController.addUser = async (req, res, next) => {
    const user = await utils.authorizeAdmin(req, res);

    await authCtrl._addUser(req, res, next);
}

adminController.disableUser = async (req, res, next) => {
    const user = await utils.authorizeAdmin(req, res);

    const userId = req.body.userId;
    if (userId === undefined) return res.json({ success: false, description: 'No userid provided' });

    if (user.id == userId) 
        return res.json({ success: false, description: 'You can\'t disable your own account' });
    await db.table('users').where('id', userId).update({ disabled: 1 });
	return res.json({ success: true });
}

adminController.enableUser = async (req, res, next) => {
    const user = await utils.authorizeAdmin(req, res);

    const userId = req.body.userId;
    if (userId === undefined) return res.json({ success: false, description: 'No userid provided' });

    await db.table('users').where('id', userId).update({ disabled: 0 });
	return res.json({ success: true });
}


module.exports = adminController;