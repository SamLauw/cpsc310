import {
	ApplyRuleObject, ApplyTokens,
	ConditionalFilter,
	conditionalOperators,
	FilterObject,
	LogicFilter,
	logicOperators,
	Operators,
	QueryObject
} from "../QueryObject";
import {InsightResult, ResultTooLargeError} from "../controller/IInsightFacade";
import {getAverage, getCount, getMax, getMin, getSum} from "./TransformOperations";

const maxResults: number = 5000;

/**
 * Filters the InsightResult into the columns defined in query, and adds the column name.
 *
 * @param result The InsightResult to filter
 * @param query The query object that defines the columns
 */
export function finalizeInsightResult(result: InsightResult, query: QueryObject) {
	return query.options.columns.reduce(
		(res, key) => {
			if (query.applyKeys.includes(key)) {
				return {...res, [`${key}`]: result[key]};
			}
			return {...res, [`${query.database.id}_${key}`]: result[key]};
		}, {});
}

/**
 * Sorts the InsightResult[] based on the ORDER statement in the query object
 * @param dataset The dataset as an InsightResult[], Should have all the fields in EBNF (mfield and sfield)
 * @param queryObject The representation of the query
 */
export function sortDataset(dataset: InsightResult[], queryObject: QueryObject): InsightResult[]  {
	if (queryObject.options.order === undefined) {
		return dataset;
	}

	let columns: string[];
	let dir: number = 1;
	if (typeof queryObject.options.order === "object") {
		dir = queryObject.options.order.dir;
		columns = queryObject.options.order.keys;
	} else {
		columns = [queryObject.options.order];
	}


	return dataset.sort((a, b) => {
		for (let column of columns) {
			if (a[column] < b[column]) {
				return -dir;
			}
			if (a[column] > b[column]) {
				return dir;
			}
		}
		return 0;
	});
}

/**
 * Filters the InsightResult based on the WHERE statement.
 * @param dataset The dataset as an InsightResult[], Should have all the fields in EBNF (mfield and sfield)
 * @param queryObject The representation of the query
 */
export function filterDataset(dataset: InsightResult[], queryObject: QueryObject): InsightResult[] {
	let filter: FilterObject;

	if (queryObject.filter === undefined) {
		return [...dataset];
	} else {
		filter = queryObject.filter;
	}

	function comparisonFunction(element: InsightResult) {
		return performWhere(filter, element);
	}
	return dataset.filter(comparisonFunction);
}

/**
 * Filters the value based on the filter. Handles the wildcard.
 * @param value The string to filter against
 * @param filter The filter string
 *
 * @returns a boolean specifying if it passes the filter
 */
function handleAsterisk(value: string, filter: string): boolean {
	let start: boolean = filter.charAt(0) === "*";
	let end: boolean = filter.charAt(filter.length - 1) === "*";
	let split: string[] = filter.split("*");
	if (split.length === 0) {
		return true;
	}
	let string = split[start ? 1 : 0];
	let index = value.indexOf(string);

	if (index === -1) {
		return false;
	}

	if (!start && index !== 0) {
		return false;
	}

	if (!end && index + string.length !== value.length) {
		return false;
	}

	return true;
}

/**
 * Returns a boolean depending on if the element passes the filter
 * @param filter The filter that contains the operator and key-value pair
 * @param element The InsightResult element of the array
 */
function performWhere(filter: FilterObject, element: InsightResult): boolean {
	let retValue: boolean = true;
	if (isConditionalFilter(filter)) {
		switch (filter.operator) {
			case Operators.EQ:
				if (filter.key === undefined) {
					return true;
				} else {
					return element[filter.key] === filter.value;
				}
			case Operators.IS:
				if (filter.key === undefined) {
					return true;
				} else {
					if (filter.value.toString().includes("*")) {
						return handleAsterisk(element[filter.key].toString(), filter.value.toString());
					}
					return element[filter.key] === filter.value;
				}
			case Operators.LT:
				if (filter.key === undefined) {
					return true;
				} else {
					return element[filter.key] < filter.value;
				}
			case Operators.GT:
				if (filter.key === undefined) {
					return true;
				} else {
					return element[filter.key] > filter.value;
				}
		}
	} else if (isLogicFilter(filter)) {
		switch (filter.operator) {
			case Operators.AND:
				retValue = true;
				filter.ExtraOperators.forEach((f) => retValue = retValue && performWhere(f, element));
				return retValue;
			case Operators.OR:
				retValue = false;
				filter.ExtraOperators.forEach((f) => retValue = retValue || performWhere(f, element));
				return retValue;
			case Operators.NOT:
				return !performWhere(filter.ExtraOperators[0], element);

		}
	}

	throw new Error("The filter object was created incorrectly");
}

/**
 * Returns whether filter is a ConditionalFilter
 * @param filter
 */
function isConditionalFilter(filter: FilterObject): filter is ConditionalFilter {
	return conditionalOperators.includes(filter.operator);
}

/**
 * Returns whether filter is a LogicFilter
 * @param filter
 */
function isLogicFilter(filter: FilterObject): filter is LogicFilter {
	return logicOperators.includes(filter.operator);
}

/**
 * Validates that the InsightResult[] can be returned
 * @param dataset
 */
export function validateResult(dataset: InsightResult[]) {
	if (dataset.length > maxResults) {
		throw new ResultTooLargeError("Too many results. Try tightening your query conditions.");
	}
}

/**
 * Applies the transform and apply in the query
 *
 * @param dataset The filtered dataset
 * @param query The queryObject based on the current query
 */
export function transformDataset(dataset: InsightResult[], query: QueryObject): InsightResult[] {
	if (query.transformation === null || query.transformation === undefined) {
		return dataset;
	}

	let map: Map<string, InsightResult[]> = new Map<string, InsightResult[]>();
	dataset.forEach((result) => {
		let key: string = "";
		query.transformation?.group.forEach((column) => {
			key += result[column];
		});

		if (map.get(key)?.push(result) === undefined) {
			map.set(key, [result]);
		}
	});

	let transformedDataset: InsightResult[] = [];
	map.forEach((groupedList) => { // do the APPLY and flatten the results
		let result: InsightResult = applyAndFlattenResults(groupedList, query);
		transformedDataset.push(result);
	});

	return transformedDataset;
}

/**
 * performs the APPLY against the groupedList, and flattens the list to one result
 * @param groupedList The list that was grouped
 * @param query the query
 */
function applyAndFlattenResults(groupedList: InsightResult[], query: QueryObject): InsightResult {
	let applyList: ApplyRuleObject[] = query.transformation?.apply ?? [];

	let result: InsightResult = query.transformation?.group.reduce<InsightResult>((previousValue, currentValue) => { // flatten result into GROUP columns
		let firstRes = groupedList.at(0);
		if (firstRes !== undefined) {
			previousValue[currentValue] = firstRes[currentValue];
		}
		return previousValue;
	}, {}) ?? {};

	applyList.forEach((applyObject) => {
		let res: number = 0;
		switch (applyObject.applyToken) {
			case ApplyTokens.AVG:
				res = getAverage(groupedList, applyObject.column);
				break;
			case ApplyTokens.MIN:
				res = getMin(groupedList, applyObject.column);
				break;
			case ApplyTokens.MAX:
				res = getMax(groupedList, applyObject.column);
				break;
			case ApplyTokens.SUM:
				res = getSum(groupedList, applyObject.column);
				break;
			case ApplyTokens.COUNT:
				res = getCount(groupedList, applyObject.column);
				break;
		}

		result[applyObject.applyKey] = res;
	});

	return result;
}
