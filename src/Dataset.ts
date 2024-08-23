import {InsightDataset, InsightResult} from "./controller/IInsightFacade";

export default class Dataset {
	public dataset: InsightDataset;
	public data: InsightResult[];

	constructor(dataset: InsightDataset, data: InsightResult[]) {
		this.data = data;
		this.dataset = dataset;
	}

	public getInsightData(): InsightDataset {
		return this.dataset;
	}

	public getInsightResults(): InsightResult[] {
		return this.data;
	}
}
