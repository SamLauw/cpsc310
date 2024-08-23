import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError
} from "./IInsightFacade";
import {QueryObject} from "../QueryObject";
import {parseQuery} from "../utility/QueryConstructor";
import {
	filterDataset,
	finalizeInsightResult,
	sortDataset,
	transformDataset,
	validateResult
} from "../utility/PerformQuery";
import Dataset from "../Dataset";
import {writeJSONSync} from "fs-extra";
import {existsSync, unlinkSync} from "fs";
import {DatasetCache} from "../utility/DatasetCache";
import {AddDatasetUtils} from "../utility/AddDatasetUtils";
import {addedDataDir, DatasetUtils, dir} from "../utility/DatasetUtils";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	constructor() {
		console.log("InsightFacadeImpl::init()");
	}

	public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		let addData = new AddDatasetUtils();
		addData.makeDirectory();
		return addData.addDataValidateId(id).catch((err) => Promise.reject(err)).then(() => {
			try {
				return addData.parseContent(id, content, kind);
			} catch (e1) {
				return Promise.reject(new InsightError("file cannot be read"));
			}
		}).then((item) => {
			if (item.length === 0) {
				return Promise.reject(new InsightError("No file exists in the target folder"));
			}
			return addData.formatting(item, kind);

		}).then((data) => {
			if (data.length === 0) {
				return Promise.reject(new InsightError("Returned data is empty"));
			}
			let insightData: InsightDataset = {id: id, kind: kind, numRows: data.length};
			let dataset = new Dataset(insightData, data);
			writeJSONSync(dir + "/datasets/" + id + ".json", dataset);
			DatasetCache.set(id, dataset);
			return addData.getAddedId().then((addedId) => {
				addedId.addedId.push(insightData);
				writeJSONSync(addedDataDir, addedId);
				return addData.getListOfIds(addedId, insightData);
			});
		});
	}

	public removeDataset(id: string): Promise<string> {
		let removeData = new DatasetUtils();
		removeData.makeDirectory();
		try {
			removeData.validateId(id);
		} catch (e) {
			return Promise.reject(e);
		}
		let bool = removeData.checkId(id);
		return bool.then((b) => {
			if (!b) {
				return Promise.reject(new NotFoundError("Id inputted has not been added"));
			}
			try {
				unlinkSync(dir + "/datasets/" + id + ".json");
				DatasetCache.remove(id);
			} catch (e) {
				return Promise.reject(new InsightError("Failed to remove dataset"));
			}
			return removeData.getAddedId();

		}).then((addedId) => {
			let index = addedId.addedId.findIndex((object: InsightDataset) => {
				return object.id === id;
			});
			if (index !== -1) {
				addedId.addedId.splice(index, 1);
			}
			writeJSONSync(addedDataDir, addedId);
			return Promise.resolve(id);
		});
	}

	public performQuery(query: unknown): Promise<InsightResult[]> {
		return this.listDatasets().then((datasets) => {
			let queryObject: QueryObject = parseQuery(query, datasets);
			let dataset: Dataset = DatasetCache.get(queryObject.database.id);
			let filteredDataset: InsightResult[] = filterDataset(dataset.data, queryObject);
			let transformedDataset: InsightResult[] = transformDataset(filteredDataset, queryObject);
			let sortedDataset: InsightResult[] = sortDataset(transformedDataset, queryObject);

			let returnedDataset: InsightResult[] = sortedDataset.map((t) => finalizeInsightResult(t, queryObject));

			validateResult(returnedDataset);

			return returnedDataset;

		});
	}

	public listDatasets(): Promise<InsightDataset[]> {
		let data = new DatasetUtils();
		data.makeDirectory();
		if (existsSync(addedDataDir)) {
			let addedId = data.getAddedId();
			return addedId.then((ids) => {
				return ids.addedId;
			});
		} else {
			return Promise.resolve([]);
		}
	}
}
