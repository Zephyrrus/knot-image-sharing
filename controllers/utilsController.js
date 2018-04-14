const path = require('path');
const config = require('../config.js');
const fs = require('fs');
const gm = require('gm');
const ffmpeg = require('fluent-ffmpeg');
const db = require('knex')(config.database);

const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

const utilsController = {};
utilsController.imageExtensions = ['.jpg', '.jpeg', '.bmp', '.gif', '.png'];
utilsController.videoExtensions = ['.webm', '.mp4', '.wmv', '.avi', '.mov'];

utilsController.getPrettyDate = function (date) {
	return date.getFullYear() + '-' +
		(date.getMonth() + 1) + '-' +
		date.getDate() + ' ' +
		(date.getHours() < 10 ? '0' : '') +
		date.getHours() + ':' +
		(date.getMinutes() < 10 ? '0' : '') +
		date.getMinutes() + ':' +
		(date.getSeconds() < 10 ? '0' : '') +
		date.getSeconds();
}

utilsController.getPrettyBytes = num => {
	// MIT License
	// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
	if (!Number.isFinite(num)) {
		return num
	}

	const neg = num < 0
	if (neg) {
		num = -num
	}
	if (num < 1) {
		return (neg ? '-' : '') + num + ' B'
	}

	const exponent = Math.min(Math.floor(Math.log10(num) / 3), units.length - 1)
	const numStr = Number((num / Math.pow(1000, exponent)).toPrecision(3))
	const unit = units[exponent]

	return (neg ? '-' : '') + numStr + ' ' + unit
}

utilsController.authorize = async (req, res, next) => {
	const token = req.headers.token;
	if (token === undefined)
		return next({
			status: 401,
			message: 'No token provided'
		}) && false;

	const user = await db.table('users').where('token', token).first();
	if (!user)
		return next({
			status: 401,
			message: 'Invalid token'
		}) && false;
	if (user.disabled)
		return next({
			status: 401,
			message: 'Disabled user'
		}) && false;
	return user;
};

utilsController.authorizeAdmin = async (req, res, next) => {
	const token = req.headers.token;
	if (token === undefined)
		return next({
			status: 401,
			message: 'No token provided'
		}) && false;

	const user = await db.table('users').where('token', token).first();
	if (!user)
		return next({
			status: 401,
			message: 'Invalid token'
		}) && false;
	if (user.disabled)
		return next({
			status: 401,
			message: 'Disabled user'
		}) && false;
	if (!user.admin)
		return next({
			status: 401,
			message: 'You\'re not allowed in the knot land.'
		}) && false;
	return user;
};

utilsController.generateThumbs = function (file, basedomain) {
	if (config.uploads.generateThumbnails !== true) return;
	const ext = path.extname(file.name).toLowerCase();

	let thumbname = path.join(__dirname, '..', config.uploads.folder, 'thumbs', file.name.slice(0, -ext.length) + '.png');
	fs.access(thumbname, err => {
		if (err && err.code === 'ENOENT') {
			if (utilsController.videoExtensions.includes(ext)) {
				ffmpeg(path.join(__dirname, '..', config.uploads.folder, file.name))
					.thumbnail({
						timestamps: [0],
						filename: '%b.png',
						folder: path.join(__dirname, '..', config.uploads.folder, 'thumbs'),
						size: '200x?'
					})
					.on('error', error => console.log('Error - ', error.message));
			} else {
				let size = {
					width: 200,
					height: 200
				};
				gm(path.join(__dirname, '..', config.uploads.folder, file.name))
					.resize(size.width, size.height + '>')
					.gravity('Center')
					.extent(size.width, size.height)
					.background('transparent')
					.write(thumbname, error => {
						if (error) console.log('Error - ', error);
					});
			}
		}
	});
};

utilsController.deleteFile = async file => {
	const ext = path.extname(file).toLowerCase()
	return new Promise((resolve, reject) => {
		fs.stat(path.join(__dirname, '..', config.uploads.folder, file), (error, stats) => {
			if (error) {
				return reject(error)
			}
			fs.unlink(path.join(__dirname, '..', config.uploads.folder, file), error => {
				if (error) {
					return reject(error)
				}
				if (!utilsController.imageExtensions.includes(ext) && !utilsController.videoExtensions.includes(ext)) {
					return resolve()
				}
				file = file.substr(0, file.lastIndexOf('.')) + '.png'
				fs.stat(path.join(__dirname, '..', config.uploads.folder, 'thumbs/', file), (error, stats) => {
					if (error) {
						if (error.code !== 'ENOENT') {
							console.log(error)
						}
						return resolve()
					}
					fs.unlink(path.join(__dirname, '..', config.uploads.folder, 'thumbs/', file), error => {
						if (error) {
							return reject(error)
						}
						return resolve()
					})
				})
			})
		})
	})
}

// MIT License
// Thanks https://github.com/BobbyWibowo/lolisafe
// This will return an array of IDs that could not be deleted
utilsController.bulkDeleteFilesByIds = async (ids, user) => {
	if (!user) {
		return
	}
	const files = await db.table('files')
		.whereIn('id', ids)
		.where(function () {
			if (user.username !== 'root') {
				this.where('userid', user.id)
			}
		})

	const failedids = ids.filter(id => !files.find(file => file.id === id))

	// First, we delete all the physical files
	await Promise.all(files.map(file => {
		return utilsController.deleteFile(file.name).catch(error => {
			// ENOENT is missing file, for whatever reason, then just delete from db anyways
			if (error.code !== 'ENOENT') {
				console.log(error)
				failedids.push(file.id)
			}
		})
	}))

	// Second, we filter out failed IDs
	const albumids = []
	const updateDbIds = files.filter(file => !failedids.includes(file.id))
	await Promise.all(updateDbIds.map(file => {
		return db.table('files')
			.where('id', file.id)
			.del()
			.then(() => {
				if (file.albumid && !albumids.includes(file.albumid)) {
					albumids.push(file.albumid)
				}
			})
			.catch(error => {
				console.error(error)
				failedids.push(file.id)
			})
	}))

	// Third, we update albums, if necessary
	await Promise.all(albumids.map(albumid => {
		return db.table('albums')
			.where('id', albumid)
			.update('editedAt', Math.floor(Date.now() / 1000))
	}))

	return failedids
}
module.exports = utilsController;