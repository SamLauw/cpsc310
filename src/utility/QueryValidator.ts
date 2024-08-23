import {
	options,
	Query,
	queryColumns,
	roomsmfield,
	roomssfield,
	sectionsmfield,
	sectionssfield, sfield
} from "../EBNF";
import {InsightDataset, InsightDatasetKind, InsightError} from "../controller/IInsightFacade";
import {ApplyTokens, TransformationObject, validTokens} from "../QueryObject";

/**
 * Returns true if the query object is properly formatted, otherwise throws an InsightError with the problem
 * @param query the query object
 */
export function isQuery(query: unknown): query is Query {
	if (query === null || query === undefined || typeof query !== "object") {
		throw new InsightError("Invalid Query String");
	}

	let existsQuery = query as Query;

	if (existsQuery.WHERE === null || existsQuery.WHERE === undefined || typeof existsQuery.WHERE !== "object") {
		throw new InsightError("missing WHERE clause");
	}

	if (existsQuery.OPTIONS === null || existsQuery.OPTIONS === undefined || typeof existsQuery.OPTIONS !== "object") {
		throw new InsightError("missing OPTIONS clause");
	}

	let queryOptions = existsQuery.OPTIONS;
	let columns = queryOptions.COLUMNS;
	if (columns === null || columns === undefined || typeof columns !== "object") {
		throw new InsightError("missing COLUMNS clause in OPTIONS");
	}

	if (!Array.isArray(columns) || columns.length === 0) {
		throw new InsightError("COLUMNS must be a non-empty array");
	}

	let queryTransformations = existsQuery.TRANSFORMATIONS;
	if (queryTransformations !== null && queryTransformations !== undefined) {
		if (typeof queryTransformations !== "object") {
			throw new InsightError("TRANSFORMATIONS must be an object");
		}
	}

	Object.keys(existsQuery).forEach((key) => {
		if (!queryColumns.includes(key)) {
			throw new InsightError("Excess keys in Query");
		}
	});

	return true;
}

/**
 * Validates the OPTIONS part of the query. Throws an error if there is a problem
 * @param query well formatted query (passed through isQuery)
 * @param dataset dataset name
 * @param applyKeys the apply keys in the query
 * @param transformation the transformationObject created from the query
 */
export function validateOptions(query: Query, dataset: InsightDataset,
	applyKeys: string[], transformation: TransformationObject | undefined) {
	let currOptions = query.OPTIONS;

	Object.keys(currOptions).forEach((option) =>  {
		if (!options.includes(option)) {
			throw new InsightError("Invalid key in OPTIONS");
		}
	});

	if (!Array.isArray(currOptions.COLUMNS)) {
		throw new InsightError("COLUMNS must be a non-empty array");
	}
	currOptions.COLUMNS.forEach((column) => validateColumn(column, dataset, "COLUMNS", applyKeys, transformation));

	if (currOptions.ORDER !== undefined) {
		if (typeof currOptions.ORDER === "string") {
			if (!currOptions.COLUMNS.includes(currOptions.ORDER) && !applyKeys.includes(currOptions.ORDER)) {
				throw new InsightError("ORDER must be in COLUMNS or APPLY");
			}

			validateColumn(currOptions.ORDER, dataset, "ORDER", applyKeys);

		} else if (typeof currOptions.ORDER === "object") {
			if (Array.isArray(currOptions.ORDER)) {
				throw new InsightError("Invalid ORDER type");
			}

			if (!Array.isArray(currOptions.ORDER.keys)) {
				throw new InsightError("ORDER must have a valid keys array");
			}

			currOptions.ORDER.keys.forEach((col) => {
				if (!currOptions.COLUMNS.includes(col) && !applyKeys.includes(col)) {
					throw new InsightError("ORDER must be in COLUMNS or APPLY");
				}
			});
		} else {
			throw new InsightError("Invalid ORDER type");
		}
	}
}

/**
 * Validates the apply key to ensure it is properly formatted.
 *
 * @param applykey the applykey to check
 * @param applyKeys the list of currently known applykeys
 */
function validateApplyKey(applykey: string, applyKeys: string[]) {
	if (applykey.length === 0) {
		throw new InsightError("Apply key cannot be empty");
	}
	if (applykey.includes("_")) {
		throw new InsightError("Cannot have underscore in applyKey");
	}
	if (applyKeys.includes(applykey)) {
		throw new InsightError("Duplicate keys in apply");
	}
}

/**
 * Validates the transformations column and returns applyKeys for further validation.
 * @param query
 * @param dataset
 */
export function validateTransformations(query: Query, dataset: InsightDataset): string[] {
	let transformation = query.TRANSFORMATIONS;
	if (transformation === null || transformation === undefined) {
		return [];
	}

	let apply = transformation.APPLY;
	let group = transformation.GROUP;

	if (apply === null || apply === undefined) {
		throw new InsightError("TRANSFORMATIONS missing APPLY");
	}

	if (group === null || group === undefined) {
		throw new InsightError("TRANSFORMATIONS missing GROUP");
	}

	if (!Array.isArray(apply)) {
		throw new InsightError("APPLY must be an array");
	}

	if (typeof group !== "object" || !Array.isArray(group)) {
		throw new InsightError("GROUP must be object");
	}

	let applyRules: string[] = [];
	apply.forEach((rule) => {
		let rules = Object.keys(rule); // assume apply is properly formatted. Will get validated during construction.
		if (rules.length > 1) {
			throw new InsightError(`Apply rule should only have 1 key, has ${rules.length}`);
		}
		rules.forEach((applykey) => {
			validateApplyKey(applykey, applyRules);
			applyRules.push(applykey);
		});
	});

	group.forEach((key) => {
		if (typeof key !== "string") {
			throw new InsightError("Keys in GROUP must be strings");
		}
		validateColumn(key, dataset, "GROUP", applyRules);
	});

	return applyRules;
}

/**
 * Validates the column part of the query. Throws an error if there is a problem
 * @param column column string
 * @param dataset dataset name
 * @param area area of column (ex. COLUMNS, GT, EQ, ORDER, etc.)
 * @param applyKeys the applykeys in the query
 * @param transformation the transformation in the query
 */
export function validateColumn(column: string, dataset: InsightDataset, area: string,
							   applyKeys: string[], transformation?: TransformationObject) { // could extract to only transformation instead of both applyKeys and transformation
	if (column === undefined) {
		throw new InsightError(`${area} must not be empty`);
	}

	let splitKey = column.split("_");
	let fields = dataset.kind === InsightDatasetKind.Sections ? [... sectionssfield, ... sectionsmfield]
		: [... roomsmfield, ... roomssfield];

	if (splitKey.length === 1 && applyKeys.includes(splitKey[0])) {
		return;
	}

	if (splitKey.length !== 2 || !(fields.includes(splitKey[1]))) {
		throw new InsightError(`Invalid key ${column} in ${area}`);
	}

	if (transformation !== null && transformation !== undefined && !transformation.group.includes(splitKey[1])) {
		throw new InsightError("Keys in COLUMNS must be in GROUP or APPLY when TRANSFORMATIONS is present");
	}

	if (splitKey.length === 2 && splitKey[0] !== dataset.id) {
		throw new InsightError("Cannot query on more than 1 dataset");
	}
}

/**
 * Validate the column based on the token.
 * @param column the column stripped of the dataset
 * @param token the apply token to check
 */
export function validateTokenAndColumn(column: string, token: ApplyTokens) {
	if (!validTokens.includes(token)) {
		throw new InsightError("Invalid transformation operator");
	}

	if (token !== ApplyTokens.COUNT && sfield.includes(column)) { // if is an sfield and not COUNT, invalid (since COUNT is the only one that works with strings)
		throw new InsightError(`Invalid key type in ${token}`);
	}
}

