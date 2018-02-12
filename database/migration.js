const config = require('../config.js');
const db = require('knex')(config.database);

const migration = {};
migration.start = async () => {
	await db.schema.table('albums', table => {
		table.dateTime('editedAt');
		table.dateTime('zipGeneratedAt');
	});
	await db.schema.table('users', table => {
		table.integer('admin')
	})
	console.log('Migration finished! Now start lolisafe normally');
};

migration.start();
