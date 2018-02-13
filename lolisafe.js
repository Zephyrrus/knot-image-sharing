const config = require('./config.js');
const api = require('./routes/api.js');
const album = require('./routes/album.js');
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const RateLimit = require('express-rate-limit');
const db = require('knex')(config.database);
const fs = require('fs');
const safe = express();
const nunjucks = require('nunjucks');

require('./database/db.js')(db);

fs.existsSync('./pages/custom' ) || fs.mkdirSync('./pages/custom');
fs.existsSync('./' + config.logsFolder) || fs.mkdirSync('./' + config.logsFolder);
fs.existsSync('./' + config.uploads.folder) || fs.mkdirSync('./' + config.uploads.folder);
fs.existsSync('./' + config.uploads.folder + '/thumbs') || fs.mkdirSync('./' + config.uploads.folder + '/thumbs');
fs.existsSync('./' + config.uploads.folder + '/zips') || fs.mkdirSync('./' + config.uploads.folder + '/zips')

safe.use(helmet());
safe.set('trust proxy', 1);

//safe.engine('pug', exphbs({ defaultLayout: 'main' }));

nunjucks.configure('views', {
    autoescape: true,
    express: safe
});
safe.set('view engine', 'html');
safe.enable('view cache');

let limiter = new RateLimit({ windowMs: 5000, max: 2 });
safe.use('/api/login/', limiter);
safe.use('/api/register/', limiter);

safe.use(bodyParser.urlencoded({ extended: true }));
safe.use(bodyParser.json());

if (config.serveFilesWithNode) {
	safe.use('/', express.static(config.uploads.folder));
}

safe.use('/', express.static('./public'));
safe.use('/', album);
safe.use('/api', api);

for (let page of config.pages) {
	let root = './pages/';
	if (fs.existsSync(`./pages/custom/${page}.html`)) {
		root = './pages/custom/';
	}
	if (page === 'home') {
		//safe.get('/', (req, res, next) => res.sendFile(`${page}.html`, { root: root }));
		safe.get('/', (req, res, next) => res.render('home'))
	} else {
		//safe.get(`/${page}`, (req, res, next) => res.sendFile(`${page}.html`, { root: root }));
		safe.get(`/${page}`, (req, res, next) => res.render(page))
	}
}

safe.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        description: err.message,
		success: false,
		status: err.status
    });
});

safe.use((req, res, next) => res.status(404).sendFile('404.html', { root: './pages/error/' }));
safe.use((req, res, next) => res.status(500).sendFile('500.html', { root: './pages/error/' }));

safe.listen(config.port, () => console.log(`lolisafe started on port ${config.port}`));
