import AddedId from "../AddedId";
import {mkdirSync, readJSONSync} from "fs-extra";
import {InsightError} from "../controller/IInsightFacade";
import {existsSync} from "fs";

export const dir = "./data";
export const addedDataDir = `${dir}/addedId.json`;

export class DatasetUtils {
	/**
	 * Check if directory data exists
	 * If it doesn't, create empty data directory
	 * Then check if datasets directory exist within data directory
	 * If it doesn't, create empty datasets directory
	 */
	public makeDirectory() {
		if (!existsSync(dir)) {
			mkdirSync(dir);
		}
		let dir1 = `${dir}/datasets`;
		if (!existsSync(dir1)) {
			mkdirSync(dir1);
		}
	}

	/**
	 * return a promise of AddedId that has already been added
	 */
	public getAddedId(): Promise<AddedId> {
		let file = readJSONSync(addedDataDir, "utf-8");
		return Promise.resolve(file);
	}

	/**
	 * Check the validity of id inputted
	 * @param id
	 * @private throw error if id is null
	 * throw error if id includes underscore
	 * throw error if id is a whitespace
	 * throw error if id is a duplicate
	 */
	public validateId(id: string): void { // make function return promise
		if (id === null || id === undefined) {
			throw new InsightError("Null id inputted");
		} else if (id.includes("_")) {
			throw new InsightError("Inputted id contains underscore");
		} else if (id.trim().length === 0) {
			throw new InsightError("Inputted id is only whitespaces");
		}
	}

	public checkDuplicate(id: string): Promise<boolean> {
		let promisedAddedId = this.getAddedId();
		return promisedAddedId.then((addedId) => {
			let listOfAddedId: string[] = [];
			addedId.addedId.forEach((dataset) => listOfAddedId.push(dataset.id));
			return listOfAddedId.includes(id);
		});
	}

	/**
	 * Check if id is already in the dataset
	 * @param id
	 * @private check through list of addedIds
	 * if id is inside addedIds, return true
	 * if not, return false
	 */
	public checkId(id: string): Promise<boolean> {
		if (existsSync(addedDataDir)) {
			return this.checkDuplicate(id);
		}
		return Promise.resolve(false);
	}
}
