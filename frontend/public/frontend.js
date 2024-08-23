// import {readFileSync} from "fs";

let popup = document.getElementById("upload")
let successPop = document.getElementById("successMessage")
let errorPop = document.getElementById("errorMessage")

function addDataPop() {
	popup.classList.add("show-container")
}

function closeAddData() {
	popup.classList.remove("show-container");
}

function openConfirmWindow() {
	successPop.classList.add("show-confirm");
}

function closeConfirmWindow() {
	successPop.classList.remove("show-confirm");
	refreshDatasets();
}

function openErrorWindow() {
	errorPop.classList.add("show-error");
}

function closeErrorWindow() {
	errorPop.classList.remove("show-error");
}

document.getElementById("upload").addEventListener("submit", addDataset)

const sendHttpResponse = (method, url, data) => {
	const promise = new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open(method, url);
		xhr.responseType = 'json';
		xhr.setRequestHeader('Content-Type', "application/zip")
		xhr.onload = () => {
			if (xhr.status === 400) {
				reject();
			}
			resolve(xhr.response);
		};

		xhr.send(data);
	});
	return promise;
}

function addDataset(e) {
	e.preventDefault();
	let temp_id = document.getElementById("id").value;
	let temp_kind = document.getElementById("kind_dropdown").value;
	let temp_content = document.getElementById("inputFile").files[0];

	let reader = new FileReader();

	reader.readAsArrayBuffer(temp_content);
	reader.onload = (e) => {
		sendHttpResponse('PUT', '/dataset/' + temp_id + '/' + temp_kind, e.target.result).then(res => {
			openConfirmWindow();
		}).catch(err => {
			openErrorWindow();
		})
	}
}

function makeDataset(datasetContainer, item) {
	let dataset = document.createElement("div");
	dataset.classList.add("dataset");

	let datasetId = document.createElement("label");
	datasetId.textContent = item.id
	dataset.appendChild(datasetId);

	let removeButton = document.createElement("button");
	removeButton.classList.add("removeData");
	removeButton.textContent = "Remove";
	removeButton.onclick = function () {
		deleteDataset(item.id);
	}
	dataset.appendChild(removeButton);

	let queryButton = document.createElement("button");
	queryButton.classList.add("queryData");
	dataset.appendChild(queryButton);

	let ref = document.createElement("a");
	ref.href = '/query'
	ref.textContent = "Query";
	queryButton.appendChild(ref);

	datasetContainer.appendChild(dataset);
}

function refreshDatasets() {
	let datasetContainer = document.getElementById("datasets");
	datasetContainer.innerHTML = ""
	sendHttpResponse('GET', '/datasets').then(res => {
		res.result.forEach(items => {
			makeDataset(datasetContainer, items)
		})
	}).catch(err => {
		openErrorWindow();
	});
}

function deleteDataset(id) {
	sendHttpResponse('DELETE', '/dataset/' + id).then(res => {
		openConfirmWindow();
	}).catch(err => {
		openErrorWindow();
	})
}
