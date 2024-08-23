let maxRowsPerPage = 20;
let currPage = 0;
let currResult = null;

document.getElementById("query-form").addEventListener("submit", performQuery);

function updateError(errorString) {
	document.getElementById("error-text").style.display = "inline-block";
	document.getElementById("error-text").innerText = errorString;
}

function hideError() {
	document.getElementById("error-text").style.display = "none";
}

function performQuery(e) {
	e.preventDefault();
	e.stopPropagation();
	const formData = new FormData(e.currentTarget);
	const query = formData.get("Query Text");
	let json;

	try {
		json = JSON.parse(query)
	} catch(e) {
		updateError("Invalid JSON string");
		document.getElementById("results-table").innerHTML = "";
		removePageSelector();
		return;
	}

	const xhr = new XMLHttpRequest();
	xhr.open("POST", `/query`);
	xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	xhr.onreadystatechange = handleQuery;
	xhr.send(JSON.stringify(json));
}

function handleQuery(e) {
	let xhr = e.currentTarget;
	if (xhr.readyState === XMLHttpRequest.DONE) {
		let result = JSON.parse(xhr.response);
		let status = xhr.status;
		if (status === 400) {
			updateError(result.error);
			document.getElementById("results-table").innerHTML = "";
			removePageSelector();
		}
		else {
			hideError();
			updateTablePointers();
			result = result.result;
			if (result.length === 0) {
				document.getElementById("results-table").innerHTML = "";
				currResult = null;
				return;
			}
			currResult = result;
			updateTable();
		}
	}
}

function updateTable() {
	if (currResult === null || currResult === undefined) {
		document.getElementById("results-table").innerHTML = "";
		removePageSelector();
		return;
	}

	let keys = Object.keys(currResult[0]);
	let columns = [];
	let innerHTML = "";
	keys.forEach((key) => columns.push(key));
	innerHTML += buildColumnHeaders(columns);

	if (maxRowsPerPage === "all") innerHTML += buildAllRows();
	else innerHTML += buildRows();

	document.getElementById("results-table").innerHTML = innerHTML;
	updatePageSelector();
}

function getMaxRowsPerPage() {
	let val = document.getElementById("max-rows-dropdown").value;
	if (val === "all") return "all";
	let int = parseInt(val);
	if (isNaN(int)) {
		return 20;
	}
	return int;
}


function updateTablePointers() {
	currPage = 1;
	maxRowsPerPage = getMaxRowsPerPage();
}

function removePageSelector() {
	document.getElementById("page-selector").innerHTML = "";
	document.getElementById("page-text-input").style.display = "none";
}

function updatePageSelector() {
	let innerHTML = "";

	innerHTML += buildPageSelector();

	if (maxRowsPerPage === null) {
		removePageSelector();
	} else {
		document.getElementById("page-selector").innerHTML = innerHTML;
		document.getElementById("page-text-input").style.display = "block";
	}
}

function buildPageSelector() {
	let innerHTML = "";
	let numPages = (currResult.length)/maxRowsPerPage;
	let begin = currPage;
	let end = currPage;

	while (end - begin < 20) {
		let changed = false;
		if (begin > 1) {
			begin--;
			changed = true;
		}
		if (end < Math.ceil(numPages)) {
			end++;
			changed = true;
		}

		if (!changed) {
			break;
		}
	}

	for (let i = begin; i < end; i++) {
		innerHTML += buildPageButton(i);
	}

	return innerHTML;
}

function buildPageButton(number) {
	let innerHTML = "";

	innerHTML += `<button class=\"page-selector-button ${number === currPage ? "selected-page-button" : ""}\" `
		+ `onclick=\"setPage(${number})\"> ${number} </button>`;

	return innerHTML;
}

function buildColumnHeaders(columns) {
	let innerHTML = "<tr class = \"table-header\">"
	columns.forEach((column) => {
		innerHTML += `<th class = \"results-header\"> ${column} </th>`;
	})
	innerHTML += "</tr>"
	return innerHTML;
}

function buildAllRows() {
	let innerHTML = "";

	currResult.forEach((res) => innerHTML += buildRow(res));

	return innerHTML;
}


function buildRows() {
	let beginningOfPage = maxRowsPerPage * (currPage - 1);
	let innerHTML = "";
	for (let i = beginningOfPage; i < maxRowsPerPage + beginningOfPage && i < currResult.length; i++) {
		innerHTML += buildRow(currResult[i]);
	}

	return innerHTML;
}

function buildRow(result) {
	let keys = Object.keys(result);
	let innerHTML = "<tr class = \"table-row\">";

	keys.forEach((key) => {
		innerHTML += `<td class = \"results-cell\"> ${result[key]} </td>`;
	})

	innerHTML += "</tr>";

	return innerHTML;
}

document.getElementById("query-text").addEventListener("keypress", addEndChar);
document.getElementById("query-text").addEventListener("paste", prettifyJSON);

function prettifyJSON(e) {
	e.preventDefault();
	e.stopPropagation();
	e.currentTarget.value = insertIntoString(e.currentTarget.value, e.clipboardData.getData('Text'),
		e.currentTarget.selectionStart, e.currentTarget.selectionEnd);
	try {
		e.currentTarget.value = JSON.stringify(JSON.parse(e.currentTarget.value), null, 4);
	} catch(e) {
		// do nothing
	}
}

function addEndChar(e) {
	const queryTextArea = document.getElementById("query-text");

	const key = e.key;
	const start = queryTextArea.selectionStart;
	const end = queryTextArea.selectionEnd;

	switch (key) {
		case "{":
			queryTextArea.value = insertIntoString(queryTextArea.value, "}", start, end);
			break;

		case "\"":
			queryTextArea.value = insertIntoString(queryTextArea.value, "\"", start, end);
			break;

		case "[":
			queryTextArea.value = insertIntoString(queryTextArea.value, "]", start, end);
			break;

		case "Enter":
			const split = queryTextArea.value.substring(0, start).split("\n");
			const line = queryTextArea.value.substring(0, queryTextArea.value.length - 1).split("\n")[split.length - 1];
			let tabs = 0;

			for (let i = 0; i < line.length; i+=4) {
				if (line.substring(i, i + 4) === "    ") tabs++;
				else break;
			}
			if (queryTextArea.value[start - 1] === "{" || queryTextArea.value[start - 1] === "[") tabs++;
			queryTextArea.value = insertIntoString(queryTextArea.value, "\n" + " ".repeat(tabs * 4), start, end);
			const newStart = start + 1 + tabs * 4;
			if (queryTextArea.value[newStart] === "}" || queryTextArea.value[newStart] === "]") {
				queryTextArea.value = insertIntoString(queryTextArea.value, "\n"+ " ".repeat((tabs - 1) * 4), newStart, newStart);
			}
			queryTextArea.selectionStart = start + 1 + tabs * 4;
			queryTextArea.selectionEnd = start + 1 + tabs * 4;
			e.preventDefault();
			return;

		default:
			return;
	}

	queryTextArea.selectionStart = start;
	queryTextArea.selectionEnd = start;
}

function insertIntoString(string, val, index, end) {
	return string.substring(0, index) + val + string.substring(end);
}

document.getElementById("max-rows-dropdown").addEventListener("change", updateMaxRows);

function updateMaxRows() {
	updateTablePointers();
	updateTable();
}

function setPage(pageNumber) {
	currPage = pageNumber;
	updateTable();
}

function updatePage() {
	let val = document.getElementById("page-input-field").value;
	let int = parseInt(val);
	if (!isNaN(int) && currResult !== null) {
		let pages = currResult.length/maxRowsPerPage;
		setPage(int > pages ? Math.ceil(pages) : int);
	}
	document.getElementById("page-input-field").value = "";
}
