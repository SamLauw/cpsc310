import {InsightResult} from "../controller/IInsightFacade";
import * as http from "http";

/**
 * Get information needed from index.htm
 * @param index
 * @param buildingNames
 * Go through every childNodes and if the nodeName is "tr", then there is possible information to be extracted
 * For every "tr" with relevant information, extract building shortname, fullname, and address, and put them into an object
 * Pass the object to the array
 */
export function exploreIndex(index: any, buildingNames: any[]) {
	for (let children of index.childNodes) {
		if (children.nodeName === "tr") {
			let keyExist = [false, false, false];
			let fullname: string = "", shortname: string = "", address: string = "";
			for (let child of children.childNodes) {
				if (child.nodeName === "td" && child.attrs[0].value.includes("field-building-code")) {
					let temp = child.childNodes[0].value;
					shortname = temp.replace("\n", "").trim();
					keyExist[1] = true;
				}
				if (child.nodeName === "td" && child.attrs[0].value.includes("views-field-title")) {
					fullname = child.childNodes[1].childNodes[0].value;
					keyExist[0] = true;
				}
				if (child.nodeName === "td" && child.attrs[0].value.includes("field-building-address")) {
					let temp = child.childNodes[0].value;
					address = temp.replace("\n", "").trim();
					keyExist[2] = true;
				}
			}
			if (!(keyExist.includes(false))) {
				let buildingInfo = {fullname, shortname, address};
				buildingNames.push(buildingInfo);
			}
		}
		if (children.childNodes !== undefined) {
			exploreIndex(children, buildingNames);
		}
	}
}

/**
 * Get information needed from each building
 * @param building
 * @param roomList
 * Go through every childNodes and if the nodeName is "tr", then there is possible information to be extracted
 * For every "tr" with relevant information, extract rooms number, furniture, seats, type and href, and put them into an object
 * Pass the object to the array
 */
export function getRoom(building: any, roomList: any[]) {
	for (let children of building.childNodes) {
		if (children.nodeName === "tr") {
			let keyExist = [false, false, false, false, false];
			let seats: number = 0;
			let furniture: string = "", type: string = "", href: string = "", number: string = "";
			for (let child of children.childNodes) {
				if (child.nodeName === "td" && child.attrs[0].value.includes("room-number")) {
					for (let child1 of child.childNodes) {
						if (child1.nodeName === "a" && child1.attrs[0].name === "href") {
							href = child1.attrs[0].value;
							keyExist[3] = true;
							keyExist[4] = true;
							if (child1.childNodes.length !== 0) {
								number = child1.childNodes[0].value;
							}
						}
					}
				}
				if (child.nodeName === "td" && child.attrs[0].value.includes("room-capacity")) {
					let temp = child.childNodes[0].value;
					seats = Number(temp.replace("\n", "").trim());
					keyExist[0] = true;
				}
				if (child.nodeName === "td" && child.attrs[0].value.includes("room-furniture")) {
					let temp = child.childNodes[0].value;
					furniture = temp.replace("\n", "").trim();
					keyExist[1] = true;
				}
				if (child.nodeName === "td" && child.attrs[0].value.includes("room-type")) {
					let temp = child.childNodes[0].value;
					type = temp.replace("\n", "").trim();
					keyExist[2] = true;
				}
			}
			if (!(keyExist.includes(false))) {
				let roomInfo = {number, seats, furniture, type, href};
				roomList.push(roomInfo);
			}
		}
		if (children.childNodes !== undefined) {
			getRoom(children, roomList);
		}
	}
}

/**
 * Get latitude and longitude of building
 * @param address
 * Encode the address of the building and pass it to get function of http
 * Returned data from http is an Json object that has lat and lon attributes
 * Set lat and lon to be that of lat and lon returned
 * Any fail will resul on 404 error
 */
export function getLatLon(address: string): Promise<object> {
	let urlAddress = encodeURI(address);
	let url = "http://cs310.students.cs.ubc.ca:11316/api/v1/project_team211/" + urlAddress;
	return new Promise((resolve, reject) => {
		http.get(url, (response: any) => {
			let returnedData = "";
			response.on("data", (chunk: any) => {
				returnedData = returnedData + chunk;
			});

			response.on("end", () => {
				try {
					if (returnedData.includes("error")) {
						reject(404);
					}
					let jsonData = JSON.parse(returnedData);
					resolve(jsonData);
				} catch (e) {
					reject(404);
				}
			}).on("error", () => {
				reject(404);
			});
		});
	});
}

/**
 * Compile room data
 * @param buildingsInfo
 * @param roomList
 * Match the index of the building with buildings information extracted from index.htm
 * Set roomData object that contains all information needed
 * Returns array of roomData
 */
export function getRoomData(buildingsInfo: any[], roomList: any[]): Promise<InsightResult[]> {
	let href = roomList[0].href;
	let index = -1;
	for (let i = 0; i < buildingsInfo.length; i++) {
		if (href.includes(buildingsInfo[i].shortname)) {
			index = i;
		}
	}
	if (index !== -1) {
		let promArray: Array<Promise<InsightResult>> = [];
		for (let rooms of roomList) {
			let prom = getLatLon(buildingsInfo[index].address).then((res: any) => {
				let roomData: InsightResult = {
					fullname: buildingsInfo[index].fullname,
					shortname: buildingsInfo[index].shortname,
					number: rooms.number,
					name: buildingsInfo[index].shortname + "_" + rooms.number,
					address: buildingsInfo[index].address,
					lat: res.lat,
					lon: res.lon,
					seats: rooms.seats,
					furniture: rooms.furniture,
					type: rooms.type,
					href: rooms.href
				};
				return roomData;
			});
			promArray.push(prom);
		}
		return Promise.allSettled(promArray).then((values) => {
			let array: any[] = [];
			values.forEach((value) => {
				if (value.status === "fulfilled") {
					array.push(value.value);
				}
			});
			return array;
		});
	}
	return Promise.resolve([]);
}
