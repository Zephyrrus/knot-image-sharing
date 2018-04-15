function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

const panel = {
	page: undefined,
	username: undefined,
	token: localStorage.token,
	filesView: localStorage.filesView,
	clipboardJS: undefined,
	selectedFiles: [],
	selectAlbumContainer: undefined,
	checkboxes: undefined,
	lastSelected: undefined
}


panel.preparePage = function () {
	if (!panel.token) return window.location = '/auth';
	panel.verifyToken(panel.token, true);
}

panel.verifyToken = function (token, reloadOnError) {
	if (reloadOnError === undefined)
		reloadOnError = false;

	axios.post('/api/tokens/verify', {
			token: token
		})
		.then(function (response) {

			if (response.data.success === false) {
				swal({
					title: "An error ocurred",
					text: response.data.description,
					type: "error"
				}, function () {
					if (reloadOnError) {
						localStorage.removeItem("token");
						location.location = '/auth';
					}
				})
				return;
			}

			axios.defaults.headers.common['token'] = token;
			localStorage.token = token;
			panel.token = token;
			panel.username = response.data.username;
			panel.admin = response.data.admin;
			return panel.prepareDashboard();

		})
		.catch(function (error) {
			return swal("An error ocurred", 'There was an error with the request, please check the console for more information.', "error");
			console.log(error);
		});

}

panel.prepareDashboard = function () {
	panel.page = document.getElementById('page');
	document.getElementById('auth').style.display = 'none';
	document.getElementById('dashboard').style.display = 'block';

	document.getElementById('itemUploads').addEventListener('click', function () {
		panel.setActiveMenu(this);
	});

	document.getElementById('itemManageGallery').addEventListener('click', function () {
		panel.setActiveMenu(this);
	});

	document.getElementById('itemTokens').addEventListener('click', function () {
		panel.setActiveMenu(this);
	});

	document.getElementById('itemPassword').addEventListener('click', function () {
		panel.setActiveMenu(this);
	});

	document.getElementById('itemLogout').innerHTML = `Logout ( ${panel.username} )`;

	document.getElementById('itemAdminUsers').addEventListener('click', function () {
		panel.setActiveMenu(this);
	});

	if (!panel.admin) {
		document.getElementById('adminSidebar').style.display = 'none';
	}

	panel.getAlbumsSidebar();
}

panel.logout = function () {
	localStorage.removeItem("token");
	location.reload('/');
}

panel.closeModal = () => {
	document.getElementById('modal').className = 'modal'
}


panel.isLoading = (element, state) => {
	if (!element) {
		return
	}
	if (state && !element.className.includes(' is-loading')) {
		element.className += ' is-loading'
	} else if (!state && element.className.includes(' is-loading')) {
		element.className = element.className.replace(' is-loading', '')
	}
}


panel.getUploads = (album, page, element) => {
	if (element) {
		panel.isLoading(element, true)
	}
	if (page === undefined) {
		page = 0
	}

	let url = 'api/uploads/' + page
	if (album !== undefined) {
		url = 'api/album/' + album + '/' + page
	}

	axios.get(url).then(response => {
		if (response.data.success === false) {
			if (response.data.description === 'No token provided') {
				return panel.verifyToken(panel.token)
			} else {
				return swal('An error occurred!', response.data.description, 'error')
			}
		}

		let prevPage = 0
		let nextPage = page + 1

		if (response.data.files.length < 25) {
			nextPage = page
		}

		if (page > 0) {
			prevPage = page - 1
		}

		const pagination = `
		<nav class="pagination is-centered">
		  <a class="button pagination-previous" onclick="panel.getUploads(${album}, ${prevPage}, this)">Previous</a>
		  <a class="button pagination-next" onclick="panel.getUploads(${album}, ${nextPage}, this)">Next page</a>
		</nav>
	  `
		const controls = `
		<div class="columns">
		  <div class="column is-hidden-mobile"></div>
		  <div class="column" style="text-align: center">
			<a class="button is-small is-danger is-outlined" title="List view" onclick="panel.setFilesView('list', ${album}, ${page}, this)">
			  <span class="icon is-small">
			  	<i class="fa fa-list-ul"></i>
			  </span>
			</a>
			<a class="button is-small is-danger is-outlined" title="Thumbs view" onclick="panel.setFilesView('thumbs', ${album}, ${page}, this)">
			  <span class="icon is-small">
			  	<i class="fa fa-th-large"></i>
			  </span>
			</a>
		  </div>
		  <div class="column" style="text-align: right">
			<a class="button is-small is-info is-outlined" title="Clear selection" onclick="panel.clearSelection()">
			  <span class="icon is-small">
			  	<i class="fa fa-times"></i>
			  </span>
			</a>
			<a class="button is-small is-warning is-outlined" title="Add selected files to album" onclick="panel.addSelectedFilesToAlbum(${album})">
			  <span class="icon is-small">
			  	<i class="fa fa-plus"></i>
			  </span>
			</a>
			<a class="button is-small is-danger is-outlined" title="Bulk delete" onclick="panel.deleteSelectedFiles(${album})">
			  <span class="icon is-small">
			  	<i class="fa fa-trash"></i>
			  </span>
			  <span>Bulk delete</span>
			</a>
		  </div>
		</div>
	  `

		let allFilesSelected = true
		if (panel.filesView === 'thumbs') {
			panel.page.innerHTML = `
		  ${pagination}
		  <hr>
		  ${controls}
		  <div class="columns is-multiline is-mobile is-centered" id="table">
  
		  </div>
		  ${pagination}
		`

			const table = document.getElementById('table')

			for (const file of response.data.files) {
				const selected = panel.selectedFiles.includes(file.id)
				if (!selected && allFilesSelected) {
					allFilesSelected = false
				}

				const div = document.createElement('div')

				let displayAlbumOrUser = file.album
				if (panel.username === 'root') {
					displayAlbumOrUser = ''
					if (file.username !== undefined) {
						displayAlbumOrUser = file.username
					}
				}

				div.className = 'image-container column is-narrow'
				if (file.thumb !== undefined) {
					div.innerHTML = `<a class="image" href="${file.file}" target="_blank"><img src="${file.thumb}"/></a>`
				} else {
					div.innerHTML = `<a class="image" href="${file.file}" target="_blank"><h1 class="title">.${file.file.split('.').pop()}</h1></a>`
				}
				div.innerHTML += `
			<input type="checkbox" class="file-checkbox" title="Select this file" data-id="${file.id}" onclick="panel.selectFile(this, event)"${selected ? ' checked' : ''}>
			<div class="controls">
			  <a class="button is-small is-info is-outlined clipboard-js" title="Copy link to clipboard" data-clipboard-text="${file.file}">
				<span class="icon is-small">
					<i class="fa fa-clipboard"></i>
				</span>
			  </a>
			  <a class="button is-small is-warning is-outlined" title="Add to album" onclick="panel.addToAlbum([${file.id}], ${album})">
				<span class="icon is-small">
					<i class="fa fa-plus"></i>
				</span>
			  </a>
			  <a class="button is-small is-danger is-outlined" title="Delete file" onclick="panel.deleteFile(${file.id}, ${album}, ${page})">
				<span class="icon is-small">
					<i class="fa fa-trash"></i>
				</span>
			  </a>
			</div>
			<div class="details">
			  <p><span class="name" title="${file.file}">${file.name}</span></p>
			  <p>${displayAlbumOrUser ? `<span>${displayAlbumOrUser}</span> – ` : ''}${file.size}</div>
		  `
				table.appendChild(div)
				panel.checkboxes = Array.from(table.getElementsByClassName('file-checkbox'))
			}
		} else {
			let albumOrUser = 'Album'
			if (panel.username === 'root') {
				albumOrUser = 'User'
			}

			panel.page.innerHTML = `
		  ${pagination}
		  <hr>
		  ${controls}
		  <div class="table-container">
			<table class="table is-narrow is-fullwidth is-hoverable">
			  <thead>
				<tr>
					<th><input id="selectAll" type="checkbox" title="Select all files" onclick="panel.selectAllFiles(this)"></th>
					<th style="width: 25%">File</th>
					<th>${albumOrUser}</th>
					<th>Album</th>
					<th>Size</th>
					<th>Date</th>
					<th></th>
				</tr>
			  </thead>
			  <tbody id="table">
			  </tbody>
			</table>
		  </div>
		  <hr>
		  ${pagination}
		`

			const table = document.getElementById('table')

			for (const file of response.data.files) {
				const selected = panel.selectedFiles.includes(file.id)
				if (!selected && allFilesSelected) {
					allFilesSelected = false
				}

				const tr = document.createElement('tr')

				let displayAlbumOrUser = file.album
				if (panel.username === 'root') {
					displayAlbumOrUser = ''
					if (file.username !== undefined) {
						displayAlbumOrUser = file.username
					}
				}

				tr.innerHTML = `
			<tr>
			  <th><input type="checkbox" class="file-checkbox" title="Select this file" data-id="${file.id}" onclick="panel.selectFile(this, event)"${selected ? ' checked' : ''}></th>
			  <th><a href="${file.file}" target="_blank" title="${file.file}">${file.name}</a></th>
			  <th>${displayAlbumOrUser}</th>
			  <th>${file.album}</th>
			  <td>${file.size}</td>
			  <td>${file.date}</td>
			  <td style="text-align: right">
				<a class="button is-small is-primary is-outlined" title="View thumbnail" onclick="panel.displayThumbnailModal(${file.thumb ? `'${file.thumb}'` : null})"${file.thumb ? '' : ' disabled'}>
				  <span class="icon is-small">
				  	<i class="fa fa-image"></i>
				  </span>
				</a>
				<a class="button is-small is-info clipboard-js is-outlined" title="Copy link to clipboard" data-clipboard-text="${file.file}">
				  <span class="icon is-small">
				  	<i class="fa fa-clipboard"></i>
				  </span>
				</a>
				<a class="button is-small is-warning is-outlined" title="Add to album" onclick="panel.addToAlbum([${file.id}])">
				  <span class="icon is-small">
				  	<i class="fa fa-plus"></i>
				  </span>
				</a>
				<a class="button is-small is-danger is-outlined" title="Delete file" onclick="panel.deleteFile(${file.id}, ${album}, ${page})">
				  <span class="icon is-small">
				  	<i class="fa fa-trash"></i>
				  </span>
				</a>
			  </td>
			</tr>
		  `

				table.appendChild(tr)
				panel.checkboxes = Array.from(table.getElementsByClassName('file-checkbox'))
			}
		}

		if (allFilesSelected && response.data.files.length) {
			const selectAll = document.getElementById('selectAll')
			if (selectAll) {
				selectAll.checked = true
			}
		}
	}).catch(error => {
		console.log(error)
		return swal('An error occurred!', 'There was an error with the request, please check the console for more information.', 'error')
	})
}

panel.setFilesView = function (view, album, page) {
	localStorage.filesView = view;
	panel.filesView = view;
	panel.getUploads(album, page);
}

panel.displayThumbnailModal = thumb => {
	if (!thumb) {
		return
	}
	document.getElementById('modalImage').src = thumb
	document.getElementById('modal').className += ' is-active'
}

panel.selectAllFiles = element => {
	const table = document.getElementById('table')
	const checkboxes = table.getElementsByClassName('file-checkbox')

	for (const checkbox of checkboxes) {
		const id = parseInt(checkbox.dataset.id)
		if (isNaN(id)) {
			continue
		}
		if (checkbox.checked !== element.checked) {
			checkbox.checked = element.checked
			if (checkbox.checked) {
				panel.selectedFiles.push(id)
			} else {
				panel.selectedFiles.splice(panel.selectedFiles.indexOf(id), 1)
			}
		}
	}

	if (panel.selectedFiles.length) {
		localStorage.selectedFiles = JSON.stringify(panel.selectedFiles)
	} else {
		localStorage.removeItem('selectedFiles')
	}

	element.title = element.checked ? 'Unselect all files' : 'Select all files'
}

panel.selectInBetween = (element, lastElement) => {
	if (!element || !lastElement) {
		return
	}
	if (element === lastElement) {
		return
	}
	if (!panel.checkboxes || !panel.checkboxes.length) {
		return
	}

	const thisIndex = panel.checkboxes.indexOf(element)
	const lastIndex = panel.checkboxes.indexOf(lastElement)

	const distance = thisIndex - lastIndex
	if (distance >= -1 && distance <= 1) {
		return
	}

	for (let i = 0; i < panel.checkboxes.length; i++) {
		if ((thisIndex > lastIndex && i > lastIndex && i < thisIndex) ||
			(thisIndex < lastIndex && i > thisIndex && i < lastIndex)) {
			panel.checkboxes[i].checked = true
			panel.selectedFiles.push(parseInt(panel.checkboxes[i].dataset.id))
		}
	}

	localStorage.selectedFiles = JSON.stringify(panel.selectedFiles)
}

panel.selectFile = (element, event) => {
	if (event.shiftKey && panel.lastSelected) {
		panel.selectInBetween(element, panel.lastSelected)
	} else {
		panel.lastSelected = element
	}

	const id = parseInt(element.dataset.id)

	if (isNaN(id)) {
		return
	}

	if (!panel.selectedFiles.includes(id) && element.checked) {
		panel.selectedFiles.push(id)
	} else if (panel.selectedFiles.includes(id) && !element.checked) {
		panel.selectedFiles.splice(panel.selectedFiles.indexOf(id), 1)
	}

	if (panel.selectedFiles.length) {
		localStorage.selectedFiles = JSON.stringify(panel.selectedFiles)
	} else {
		localStorage.removeItem('selectedFiles')
	}
}

panel.clearSelection = async () => {
	const count = panel.selectedFiles.length
	if (!count) {
		return swal('An error occurred!', 'You have not selected any files.', 'error')
	}

	const suffix = `file${count === 1 ? '' : 's'}`
	const proceed = await swal({
		title: 'Are you sure?',
		text: `You are going to unselect ${count} ${suffix}.`,
		buttons: true
	})
	if (!proceed) {
		return
	}

	const table = document.getElementById('table')
	const checkboxes = table.getElementsByClassName('file-checkbox')

	for (const checkbox of checkboxes) {
		if (checkbox.checked) {
			checkbox.checked = false
		}
	}

	panel.selectedFiles = []
	localStorage.removeItem('selectedFiles')

	const selectAll = document.getElementById('selectAll')
	if (selectAll) {
		selectAll.checked = false
	}

	return swal('Cleared selection!', `Unselected ${count} ${suffix}.`, 'success')
}


panel.deleteFile = (id, album, page) => {
	swal({
		title: 'Are you sure?',
		text: 'You won\'t be able to recover the file!',
		icon: 'warning',
		dangerMode: true,
		buttons: {
			cancel: true,
			confirm: {
				text: 'Yes, delete it!',
				closeModal: false
			}
		}
	}).then(value => {
		if (!value) {
			return
		}
		axios.post('api/upload/delete', {
				id
			})
			.then(response => {
				if (response.data.success === false) {
					if (response.data.description === 'No token provided') {
						return panel.verifyToken(panel.token)
					} else {
						return swal('An error occurred!', response.data.description, 'error')
					}
				}

				swal('Deleted!', 'The file has been deleted.', 'success')
				panel.getUploads(album, page)
			})
			.catch(error => {
				console.log(error)
				return swal('An error occurred!', 'There was an error with the request, please check the console for more information.', 'error')
			})
	})
}

panel.deleteSelectedFiles = async album => {
	const count = panel.selectedFiles.length
	if (!count) {
		return swal('An error occurred!', 'You have not selected any files.', 'error')
	}

	const suffix = `file${count === 1 ? '' : 's'}`
	const proceed = await swal({
		title: 'Are you sure?',
		text: `You won't be able to recover ${count} ${suffix}!`,
		icon: 'warning',
		dangerMode: true,
		buttons: {
			cancel: true,
			confirm: {
				text: `Yes, nuke the ${suffix}!`,
				closeModal: false
			}
		}
	})
	if (!proceed) {
		return
	}

	const bulkdelete = await axios.post('api/upload/bulkdelete', {
			ids: panel.selectedFiles
		})
		.catch(error => {
			console.log(error)
			swal('An error occurred!', 'There was an error with the request, please check the console for more information.', 'error')
		})
	if (!bulkdelete) {
		return
	}

	if (bulkdelete.data.success === false) {
		if (bulkdelete.data.description === 'No token provided') {
			return panel.verifyToken(panel.token)
		} else {
			return swal('An error occurred!', bulkdelete.data.description, 'error')
		}
	}

	let deleted = count
	if (bulkdelete.data.failedids && bulkdelete.data.failedids.length) {
		deleted -= bulkdelete.data.failedids.length
		panel.selectedFiles = panel.selectedFiles.filter(id => bulkdelete.data.failedids.includes(id))
	} else {
		panel.selectedFiles = []
	}

	localStorage.selectedFiles = JSON.stringify(panel.selectedFiles)

	swal('Deleted!', `${deleted} file${deleted === 1 ? ' has' : 's have'} been deleted.`, 'success')
	return panel.getUploads(album)
}

panel.addSelectedFilesToAlbum = async album => {
	const count = panel.selectedFiles.length
	if (!count) {
		return swal('An error occurred!', 'You have not selected any files.', 'error')
	}

	const failedids = await panel.addToAlbum(panel.selectedFiles, album)
	if (!failedids) {
		return
	}
	if (failedids.length) {
		panel.selectedFiles = panel.selectedFiles.filter(id => failedids.includes(id))
	} else {
		panel.selectedFiles = []
	}
	localStorage.selectedFiles = JSON.stringify(panel.selectedFiles)
}

panel.addToAlbum = async (ids, album) => {
	const count = ids.length
	const proceed = await swal({
		title: 'Are you sure?',
		text: `You are about to move ${count} file${count === 1 ? '' : 's'} to an album.`,
		buttons: {
			cancel: true,
			confirm: {
				text: 'Yes',
				closeModal: false
			}
		}
	});
	if (!proceed) {
		return
	}

	const list = await axios.get('api/albums')
		.catch(error => {
			console.log(error)
			swal('An error occurred!', 'There was an error with the request, please check the console for more information.', 'error')
		})
	if (!list) {
		return
	}

	if (list.data.success === false) {
		if (list.data.description === 'No token provided') {
			panel.verifyToken(panel.token)
		} else {
			swal('An error occurred!', list.data.description, 'error')
		}
		return
	}

	if (!panel.selectAlbumContainer) {
		// We want to this to be re-usable
		panel.selectAlbumContainer = document.createElement('div')
		panel.selectAlbumContainer.id = 'selectAlbum'
		panel.selectAlbumContainer.className = 'select is-fullwidth'
	}

	const options = list.data.albums
		.map(album => `<option value="${album.id}">${album.name}</option>`)
		.join('\n')

	panel.selectAlbumContainer.innerHTML = `
	  <select>
		<option value="">Choose an album</option>
		<option value="-1">Remove from album</option>
		${options}
	  </select>
	  <p class="help is-danger">If a file is already in an album, it will be moved.</p>
	`

	const choose = await swal({
		content: panel.selectAlbumContainer,
		buttons: {
			cancel: true,
			confirm: {
				text: 'OK',
				closeModal: false
			}
		}
	})
	if (!choose) {
		return
	}

	const albumid = parseInt(panel.selectAlbumContainer.getElementsByTagName('select')[0].value)
	if (isNaN(albumid)) {
		swal('An error occurred!', 'You did not choose an album.', 'error')
		return
	}

	const add = await axios.post('api/albums/addfiles', {
			ids,
			albumid
		})
		.catch(error => {
			console.log(error)
			swal('An error occurred!', 'There was an error with the request, please check the console for more information.', 'error')
		})
	if (!add) {
		return
	}

	if (add.data.success === false) {
		if (add.data.description === 'No token provided') {
			panel.verifyToken(panel.token)
		} else {
			swal('An error occurred!', add.data.description, 'error')
		}
		return
	}

	let added = ids.length
	if (add.data.failedids && add.data.failedids.length) {
		added -= add.data.failedids.length
	}
	const suffix = `file${ids.length === 1 ? '' : 's'}`

	if (!added) {
		swal('An error occurred!', `Could not add the ${suffix} to the album.`, 'error')
		return
	}

	swal('Woohoo!', `Successfully ${albumid < 0 ? 'removed' : 'added'} ${added} ${suffix} ${albumid < 0 ? 'from' : 'to'} the album.`, 'success')
	panel.getUploads(album)
	return add.data.failedids
}

panel.getAlbums = function () {

	axios.get('/api/albums').then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			panel.page.innerHTML = '';
			var container = document.createElement('div');
			container.className = "container";
			container.innerHTML = `
			<h2 class="subtitle">Create new album</h2>

			<p class="control has-addons has-addons-centered">
				<input id="albumName" class="input" type="text" placeholder="Name">
				<a id="submitAlbum" class="button is-primary">Submit</a>
			</p>

			<h2 class="subtitle">List of albums</h2>

			<table class="table is-striped is-narrow">
				<thead>
					<tr>
						  <th>Name</th>
						  <th>Files</th>
						  <th>Created At</th>
						  <th>Public link</th>
						  <th></th>
					</tr>
				</thead>
				<tbody id="table">
				</tbody>
			</table>`;

			panel.page.appendChild(container);
			var table = document.getElementById('table');

			for (var item of response.data.albums) {

				var tr = document.createElement('tr');
				tr.innerHTML = `
				<tr>
					<th>${escapeHtml(item.name)}</th>
					<th>${item.files}</th>
					<td>${item.date}</td>
					<td><a href="${item.identifier}" target="_blank">Album link</a></td>
					<td>
						<a class="button is-small is-primary is-outlined" title="Edit name" onclick="panel.renameAlbum(${item.id})">
							<span class="icon is-small">
								<i class="fa fa-pencil"></i>
							</span>
						</a>
						<a class="button is-small is-info is-outlined clipboard-js" title="Copy link to clipboard" data-clipboard-text="${item.identifier}">
							<span class="icon is-small">
								<i class="fa fa-clipboard"></i>
							</span>
						</a>
						<a class="button is-small is-danger is-outlined" title="Delete album" onclick="panel.deleteAlbum(${item.id})">
							<span class="icon is-small">
								<i class="fa fa-trash-o"></i>
							</span>
						</a>
					</td>
				</tr>
				`;

				table.appendChild(tr);
			}

			document.getElementById('submitAlbum').addEventListener('click', function () {
				panel.submitAlbum();
			});

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});

}

panel.renameAlbum = function (id) {

	swal({
		title: "Rename album",
		text: "New name you want to give the album:",
		type: "input",
		showCancelButton: true,
		closeOnConfirm: false,
		animation: "slide-from-top",
		inputPlaceholder: "My super album"
	}).then(inputValue => {
		if (inputValue === false) return false;
		if (inputValue === "") {
			swal.showInputError("You need to write something!");
			return false
		}
		axios.post('/api/albums/rename', {
				id: id,
				name: inputValue
			})
			.then(function (response) {

				if (response.data.success === false) {
					if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
					else if (response.data.description === 'Name already in use') swal.showInputError("That name is already in use!");
					else swal("An error ocurred", response.data.description, "error");
					return;
				}

				swal("Success!", "Your album was renamed to: " + inputValue, "success");
				panel.getAlbumsSidebar();
				panel.getAlbums();
				return;

			})
			.catch(function (error) {
				console.log(error);
				return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
			});
	});
}

panel.deleteAlbum = function (id) {
	swal({
		title: "Are you sure?",
		text: "This won't delete your files, only the album!",
		type: "warning",
		showCancelButton: true,
		confirmButtonColor: "#ff3860",
		confirmButtonText: "Yes, delete it!",
		closeOnConfirm: false
	}).then(() => {
		axios.post('/api/albums/delete', {
				id: id
			})
			.then(function (response) {

				if (response.data.success === false) {
					if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
					else return swal("An error ocurred", response.data.description, "error");
				}

				swal("Deleted!", "Your album has been deleted.", "success");
				panel.getAlbumsSidebar();
				panel.getAlbums();
				return;

			})
			.catch(function (error) {
				console.log(error);
				return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
			});
	});

}

panel.submitAlbum = function () {
	axios.post('/api/albums', {
			name: document.getElementById('albumName').value
		})
		.then(function (response) {

			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal("Woohoo!", "Album was added successfully", "success");
			panel.getAlbumsSidebar();
			panel.getAlbums();
			return;

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.getAlbumsSidebar = function () {

	axios.get('/api/albums/sidebar')
		.then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			var albumsContainer = document.getElementById('albumsContainer');
			albumsContainer.innerHTML = '';

			if (response.data.albums === undefined) return;

			for (var album of response.data.albums) {

				li = document.createElement('li');
				a = document.createElement('a');
				a.id = album.id;
				a.innerHTML = album.name;

				a.addEventListener('click', function () {
					panel.getAlbum(this);
				});

				li.appendChild(a);
				albumsContainer.appendChild(li);
			}


		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.getAlbum = function (item) {
	panel.setActiveMenu(item);
	panel.getUploads(item.id);
}

panel.changeToken = function () {

	axios.get('/api/tokens')
		.then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			panel.page.innerHTML = '';
			var container = document.createElement('div');
			container.className = "container";
			container.innerHTML = `
			<h2 class="subtitle">Manage your token</h2>

			<label class="label">Your current token:</label>
			<p class="control has-addons">
				<input id="token" readonly class="input is-expanded" type="text" placeholder="Your token" value="${response.data.token}">
				<a id="getNewToken" class="button is-primary">Request new token</a>
			</p>
		`;

			panel.page.appendChild(container);

			document.getElementById('getNewToken').addEventListener('click', function () {
				panel.getNewToken();
			});

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.getNewToken = function () {

	axios.post('/api/tokens/change')
		.then(function (response) {

			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal({
				title: "Woohoo!",
				text: 'Your token was changed successfully.',
				type: "success"
			}).then(() => {
				localStorage.token = response.data.token;
				location.reload();
			})

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.changePassword = function () {

	panel.page.innerHTML = '';
	var container = document.createElement('div');
	container.className = "container";
	container.innerHTML = `
		<h2 class="subtitle">Change your password</h2>

		<label class="label">New password:</label>
		<p class="control has-addons">
			<input id="password" class="input is-expanded" type="password" placeholder="Your new password">
		</p>
		<label class="label">Confirm password:</label>
		<p class="control has-addons">
			<input id="passwordConfirm" class="input is-expanded" type="password" placeholder="Verify your new password">
			<a id="sendChangePassword" class="button is-primary">Set new password</a>
		</p>
	`;

	panel.page.appendChild(container);

	document.getElementById('sendChangePassword').addEventListener('click', function () {
		if (document.getElementById('password').value === document.getElementById('passwordConfirm').value) {
			panel.sendNewPassword(document.getElementById('password').value);
		} else {
			swal({
				title: "Password mismatch!",
				text: 'Your passwords do not match, please try again.',
				type: "error"
			}).then(() => {
				panel.changePassword();
			});
		}
	});
}

panel.sendNewPassword = function (pass) {
	axios.post('/api/password/change', {
			password: pass
		})
		.then(function (response) {

			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal({
				title: "Woohoo!",
				text: 'Your password was changed successfully.',
				type: "success"
			}).then(function () {
				location.reload();
			});
		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}


panel.getUsers = function () {
	axios.get('/api/admin/users').then(function (response) {
		if (response.data.success === false) {
			if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
			else return swal("An error ocurred", response.data.description, "error");
		}
		console.log(response);
		panel.page.innerHTML = '';
		var container = document.createElement('div');
		container.className = "container";
		container.innerHTML = `
			<h2 class="subtitle">Create new user</h2>
			<label class="label">Username:</label>
			<p class="control has-addons has-addons-centered">
				<input id="username_add" class="input" type="text" placeholder="User Name">	
			</p>
			<label class="label">Password:</label>
			<p class="control has-addons has-addons-centered">
				<input id="password_add" class="input" type="text" placeholder="Password">
			</p>
			<a id="submitNewUser" class="button is-success">Create</a>

			<hr>
			<h2 class="subtitle">List of users</h2>
			
			<table class="table is-striped is-narrow">
				<thead>
					<tr>
						  <th>Id</th>
						  <th>Name</th>
						  <th>Created At</th>
						  <th>Admin</th>
						  <th>Disabled</th>
						  <th></th>
					</tr>
				</thead>
				<tbody id="table">
				</tbody>
			</table>`;

		panel.page.appendChild(container);
		var table = document.getElementById('table');

		for (var item of response.data.users) {

			var tr = document.createElement('tr');
			content = `
				<tr>
					<th>${item.id}</th>
					<th>${escapeHtml(item.username)}</th>
					<td>${item.date}</td>
					<td>${item.admin}</td>
					<td>${item.disabled}</td>
					<td>`;
			if (item.disabled) {
				content += `<a class="button is-small is-primary is-outlined" title="Enable User" onclick="panel.enableUser(${item.id})">
									<span class="icon is-small">
										<i class="fa fa-check"></i>
									</span>
								</a>`;
			} else {
				content += `<a class="button is-small is-danger is-outlined" title="Disable User" onclick="panel.disableUser(${item.id})">
									<span class="icon is-small">
										<i class="fa fa-gavel"></i>
									</span>
								</a>`;
			}

			content += `
					</td>
				</tr>
				`;

			tr.innerHTML = content;
			table.appendChild(tr);
		}

		document.getElementById('submitNewUser').addEventListener('click', function () {
			panel.addNewUser();
		});

	}).catch(function (error) {
		console.log(error);
		return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
	});
}

panel.enableUser = function (userId) {
	axios.post('/api/admin/enableUser', {
			userId: userId
		})
		.then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal({
				title: "OwO!",
				text: 'User was enabled!',
				type: "success"
			}.then(function () {
				location.reload();
			})

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.disableUser = function (userId) {
	axios.post('/api/admin/disableUser', {
			userId: userId
		})
		.then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal({
				title: "Woohoo!",
				text: 'User was disabled!',
				type: "warning"
			}.then(function () {
				location.reload();
			})

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.addNewUser = function () {
	axios.post('/api/admin/addUser', {
			username: document.getElementById('username_add').value,
			password: document.getElementById('password_add').value
		})
		.then(function (response) {
			if (response.data.success === false) {
				if (response.data.description === 'No token provided') return panel.verifyToken(panel.token);
				else return swal("An error ocurred", response.data.description, "error");
			}

			swal({
				title: "Woohoo!",
				text: 'User was added!',
				type: "success"
			}.then(function () {
				location.reload();
			})

		})
		.catch(function (error) {
			console.log(error);
			return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error');
		});
}

panel.setActiveMenu = function (item) {
	var menu = document.getElementById('menu');
	var items = menu.getElementsByTagName('a');
	for (var i = 0; i < items.length; i++)
		items[i].className = "";

	item.className = 'is-active';
}

window.onload = function () {
	// Add 'no-touch' class to non-touch devices
	if (!('ontouchstart' in document.documentElement)) {
		document.documentElement.className += ' no-touch'
	}

	const selectedFiles = localStorage.selectedFiles
	if (selectedFiles) {
		panel.selectedFiles = JSON.parse(selectedFiles)
	}

	panel.preparePage()

	panel.clipboardJS = new ClipboardJS('.clipboard-js')

	panel.clipboardJS.on('success', () => {
		return swal('Copied!', 'The link has been copied to clipboard.', 'success')
	})

	panel.clipboardJS.on('error', event => {
		console.error(event)
		return swal('An error occurred!', 'There was an error when trying to copy the link to clipboard, please check the console for more information.', 'error')
	})
}