const config = require('../config.js');
const db = require('knex')(config.database);

const migration = {};
migration.start = async () => {
	await db.schema.table('albums', table => {
		table.integer('editedAt').defaultTo(0)
		table.integer('zipGeneratedAt').defaultTo(0)
	});
	await db.schema.table('users', table => {
		table.integer('admin').defaultTo(0)
		table.integer('disabled').defaultTo(0)
	})
	console.log('Migration finished! Now start lolisafe normally');
};

migration.start();
