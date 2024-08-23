import AddedId from "../AddedId";
import {writeJSONSync} from "fs-extra";
import {existsSync} from "fs";
import {InsightDataset, InsightDatasetKind, InsightError, InsightResult} from "../controller/IInsightFacade";
import JSZip from "jszip";
import {addedDataDir, DatasetUtils} from "./DatasetUtils";
import * as parse5 from "parse5";
import {exploreIndex, getRoom, getRoomData} from "./RoomUtil";

export class AddDatasetUtils extends DatasetUtils {
	/**
	 * Check if id is already in the dataset
	 * @param id
	 * @private check through list of addedIds
	 * if id is inside addedIds, return true
	 * if not, return false
	 * if addedId does not exist, create and empty one and return false
	 */
	public addDataCheckId(id: string): Promise<boolean> {
		if (existsSync(addedDataDir)) {
			return this.checkDuplicate(id);
		}
		let json = new AddedId();
		writeJSONSync(addedDataDir, json);
		return Promise.resolve(false);
	}

	/**
	 * Check the validity of id inputted
	 * @param id
	 * @private throw error if id is null
	 * throw error if id includes underscore
	 * throw error if id is a whitespace
	 * throw error if id is a duplicate
	 */
	public addDataValidateId(id: string): Promise<any> { // make function return promise
		try {
			this.validateId(id);
		} catch (e) {
			return Promise.reject(e);
		}
		let bool = this.addDataCheckId(id);
		return bool.then((b) => {
			if (b) {
				return Promise.reject(new InsightError("Inputted id already exist"));
			}
		});
	}

	/**
	 * Helper function to handle parsing section
	 * @param zip
	 */
	public parseSection(zip: any): Promise<string[]> {
		let promArray: Array<Promise<string>> = [];
		zip.folder("courses")?.forEach((relativePath: any, contents: any) => {
			promArray.push(contents.async("string"));
		});
		return Promise.all(promArray).then((items) => {
			return items;
		});
	}

	/**
	 * Helper function to handle and extract information from index.htm
	 * @param zip
	 */
	public parseIndex(zip: any): Promise<string[]> {
		return zip.file("index.htm")?.async("string").then((item: any) => {
			let indexFile = parse5.parse(item);
			let buildingNames: any[] = [];
			exploreIndex(indexFile, buildingNames);
			return buildingNames;
		});
	}

	/**
	 * Helper function to handle all buildings that needs to be parsed
	 * @param zip
	 * @param buildings information obtained from index.htm
	 * Check if buildings in the folder can be found in index.htm
	 * If the building can be found, return it in a promise array
	 * Add the buildings information from index.htm at the end of the promised array
	 */
	public parseRoom(zip: any, buildings: any[]) {
		let promArray: Array<Promise<any>> = [];
		zip.folder("campus/discover/buildings-and-classrooms/")?.forEach((relativePath: any, contents: any) => {
			let str = relativePath;
			if (str.length > 3 && str.substring(str.length - 4) === ".htm" &&
				buildings.some((building) => building.shortname === str.slice(0, -4))) {
				promArray.push(contents.async("string"));
			}
		});
		return Promise.all(promArray).then((items) => {
			let buildinglist = [buildings];
			return items.concat(buildinglist);
		});
	}

	/**
	 * Parse the JSON contents
	 * @param id
	 * @param content
	 * @param kind
	 * @private read the zip files and return a string promise containing the json objects according to the kind
	 */
	public async parseContent(id: string, content: string, kind: InsightDatasetKind): Promise<any[]> {
		let zip = new JSZip();
		return await zip.loadAsync(content, {base64: true})
			.catch(() => Promise.reject(new InsightError("Bad zip file")))
			.then((inZip) => {
				let bool = false;
				if (kind === InsightDatasetKind.Sections) {
					for (let keys of Object.keys(inZip.files)) {
						if (keys.includes("courses/")) {
							bool = true;
						}
					}
					if (!bool) {
						return Promise.reject(new InsightError("no course file exists"));
					}
					return this.parseSection(inZip);
				} else if (kind === InsightDatasetKind.Rooms) {
					for (let keys of Object.keys(inZip.files)) {
						if (keys.includes("campus/discover/buildings-and-classrooms/")) {
							bool = true;
						}
					}
					if (!Object.keys(inZip.files).includes("index.htm")) {
						return Promise.reject(new InsightError("No index available"));
					} else if (!bool) {
						return Promise.reject(new InsightError("No correct folder available"));
					}
					return this.parseIndex(inZip).then((buildings: any[]) => {
						return this.parseRoom(inZip, buildings);
					});
				} else {
					return Promise.reject(new InsightError("Invalid kind inputted"));
				}
			});
	}

	/**
	 * validate whether the result is eligible to be put in database
	 * @param jsonObject
	 */
	public fileValidation(jsonObject: any) {
		return jsonObject.Subject !== undefined && jsonObject.Course !== undefined &&
			jsonObject.Avg !== undefined && jsonObject.Professor !== undefined &&
			jsonObject.Title !== undefined && jsonObject.Pass !== undefined &&
			jsonObject.Fail !== undefined && jsonObject.Audit !== undefined &&
			jsonObject.id !== undefined && jsonObject.Year !== undefined;
	}

	/**
	 * Helper function to handle formatting section
	 * @param array list of json object
	 * @param data
	 * create a new json file with id for its name
	 * iterate through the list of JSON objects and pass its content into an array
	 * pass this array to data array which will be then pass to create csv file
	 */
	public formatSection(array: string[], data: any[]) {
		for (let objects of array) {
			let object;
			try {
				object = JSON.parse(objects);
			} catch (e) {
				throw new InsightError("File in the database is not in json format");
			}
			if (object.result === undefined) {
				throw new InsightError("Json file is not properly formatted");
			}
			for (let i in object.result) {
				let jsonObject = object.result[i];
				if (this.fileValidation(jsonObject)) {
					let year: number = Number(jsonObject.Year);
					if (jsonObject.Section !== undefined && jsonObject.Section === "overall") {
						year = 1900;
					}
					let value: InsightResult = {
						dept: jsonObject.Subject,
						id: jsonObject.Course,
						avg: jsonObject.Avg,
						instructor: jsonObject.Professor,
						title: jsonObject.Title,
						pass: jsonObject.Pass,
						fail: jsonObject.Fail,
						audit: jsonObject.Audit,
						uuid: String(jsonObject.id),
						year: year
					};
					data.push(value);
				}
			}
		}
	}

	/**
	 * Helper function to handle formatting room
	 * @param array list of buildings
	 * Take out the last element of array which contains all building information extracted from index.htm
	 * Parse each building in array, extract relevant information, and pass each rooms in the building to data array
	 * Return data array containing all rooms
	 */
	public formatRoom(array: string[]): Promise<InsightResult[]> {
		let buildingsInfo = Object.assign([], array.pop());
		let promArray = [];
		for (let objects of array) {
			let object;
			try {
				object = parse5.parse(objects);
			} catch (e) {
				throw new InsightError("File in the database is not in htm format");
			}
			let roomList: any[] = [];
			getRoom(object, roomList);
			if (roomList.length !== 0) {
				let prom: Promise<InsightResult[]> = getRoomData(buildingsInfo, roomList);
				promArray.push(prom);
			}
		}
		return Promise.all(promArray).then((res) => res.flat(1));
	}

	/**
	 *
	 * @param array list of objects
	 * @param kind The dataset kind
	 * return array of InsightResult extracted from array
	 */
	public formatting(array: string[], kind: InsightDatasetKind): Promise<InsightResult[]> {
		let data: any[] = [];
		if (kind === InsightDatasetKind.Sections) {
			this.formatSection(array, data);
		} else if (kind === InsightDatasetKind.Rooms) {
			return this.formatRoom(array);
		}
		return Promise.resolve(data);
	}

	/**
	 *
	 * @param addedId
	 * @param insightDataset
	 */
	public getListOfIds(addedId: any, insightDataset: InsightDataset): string[] {
		let promisedString: string[] = [];
		addedId.addedId.forEach((insightData: InsightDataset) => promisedString.push(insightData.id));
		return promisedString;
	}
}
