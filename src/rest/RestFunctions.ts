import {Request, Response} from "express";
import InsightFacade from "../controller/InsightFacade";
import {InsightDatasetKind, NotFoundError} from "../controller/IInsightFacade";

/**
 * Returns the result of ListDataset into res
 * @param facade
 * @param res
 */
export function ListDatasets(facade: InsightFacade, req: Request, res: Response) {
	return facade.listDatasets().then((result) => {
		res.status(200).json({
			result: result
		});
	});
}

/**
 * Adds the request dataset into the facade, and returns the result into res
 * @param facade
 * @param req
 * @param res
 */
export function AddDataset(facade: InsightFacade, req: Request, res: Response) {
	let kind: InsightDatasetKind;
	if (req.params.kind === "sections") {
		kind = InsightDatasetKind.Sections;
	} else if (req.params.kind === "rooms") {
		kind = InsightDatasetKind.Rooms;
	} else {
		res.status(400).json({
			error: "Invalid Dataset Kind"
		});
		return;
	}
	let buf: Buffer = req.body;
	return facade.addDataset(req.params.id, buf.toString("base64"), kind)
		.then((result) => {
			res.status(200).json({
				result: result
			});
		})
		.catch((err) => {
			res.status(400).json({
				error: err.message
			});
		});
}

/**
 * Removes the dataset from the facade, and returns the result into res
 * @param facade
 * @param req
 * @param res
 */
export function RemoveDataset(facade: InsightFacade, req: Request, res: Response) {
	return facade.removeDataset(req.params.id)
		.then((result) => {
			res.status(200).json({
				result: result
			});
		})
		.catch((err) => {
			let status = err instanceof NotFoundError ? 404 : 400;
			res.status(status).json({
				error: err.message
			});
		});
}

/**
 * Queries the dataset in the facade, and returns the result of the corresponding
 * performQuery call into res (error or result)
 * @param facade
 * @param req
 * @param res
 */
export function QueryDataset(facade: InsightFacade, req: Request, res: Response) {
	return facade.performQuery(req.body)
		.then((result) => {
			res.status(200).json({
				result: result
			});
		})
		.catch((err) => {
			res.status(400).json({
				error: err.message
			});
		});
}
