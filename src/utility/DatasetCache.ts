import Dataset from "../Dataset";
import * as fs from "fs-extra";
import {InsightError} from "../controller/IInsightFacade";
import {dir} from "./DatasetUtils";

/**
 * Represents a Cache for datasets.
 */
export class DatasetCache {
	private static cache: Map<string, Dataset>;

	/**
	 * Gets the dataset from the cache. If it is not in it yet, it will get it from disk.
	 * @param key
	 */
	public static get(key: string): Dataset {
		if (this.cache === undefined) {
			this.cache = new Map<string, Dataset>();
		}

		let val: Dataset | undefined = this.cache.get(key);

		if (val !== undefined) {
			return val;
		} else {
			let dataset: Dataset = this.ParseDataset.getDataset(key);
			this.cache.set(key, dataset);
			return dataset;
		}
	}

	/**
	 * Tries to remove the key from the cache. Does nothing if it does not exist, or if the cache is undefined
	 * @param key
	 */
	public static remove(key: string): void {
		if (this.cache !== undefined) {
			this.cache.delete(key);
		}
	}

	public static set(key: string, dataset: Dataset): void {
		if (this.cache === undefined) {
			this.cache = new Map<string, Dataset>();
		}
		this.cache.set(key, dataset);
	}

	/**
	 * Clears the cache
	 */
	public static clear(): void {
		if (this.cache !== undefined) {
			this.cache.clear();
		}
	}

	/**
	 * Class that handles parsing the dataset in disk to an object
	 * @private
	 */
	private static ParseDataset = class {
		/**
		 * Returns the specified dataset from the disk.
		 * Should only be called from DatasetCache.ts
		 * @param id
		 */
		public static getDataset(id: string): Dataset {
			try {
				let sectionsJSON: string = fs.readFileSync(`${dir}/datasets/${id}.json`).toString("utf8");
				return JSON.parse(sectionsJSON);
			} catch (e) {
				throw new InsightError("Dataset could not be found");
			}
		}
	};
}
