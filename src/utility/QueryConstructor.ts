import {ApplyRuleObject, ApplyTokens, ConditionalFilter, FilterObject, LogicFilter, Operators, OptionObject,
	OrderObject, QueryObject, TransformationObject} from "../QueryObject";
import {
	ApplyRule, Direction, Filter, mfield, MKeyValue, Options, Order, Query, SKeyValue, Transformation
} from "../EBNF";
import {InsightDataset, InsightError} from "../controller/IInsightFacade";
import {
	isQuery, validateOptions, validateColumn, validateTransformations, validateTokenAndColumn
} from "./QueryValidator";

/**
 * Parses the passed in query and returns a QueryObject
 * @param query the query
 *
 * @param datasets datasets returned by InsightFacade.listDatasets()
 * @return QueryObject
 */
export function parseQuery(query: unknown, datasets: InsightDataset[]): QueryObject {
	if (isQuery(query)) {
		let dataset: InsightDataset = getDatasetFromQuery(query, datasets);
		let applyKeys: string[] = validateTransformations(query, dataset);
		let transformation: TransformationObject | undefined =
			getTransformationObjectFromQuery(query.TRANSFORMATIONS, dataset);
		validateOptions(query, dataset, applyKeys, transformation);
		let optionObject: OptionObject = getOptionsObjectFromOptions(query.OPTIONS, dataset);


		if (Object.keys(query.WHERE).length === 0) { // If WHERE is empty, do not filter
			return {
				database: dataset,
				applyKeys: applyKeys,
				options: optionObject,
				transformation: transformation
			};
		}

		let filter: FilterObject = getFilterObjectFromFilter(query.WHERE, dataset, applyKeys);

		return {
			database: dataset,
			options: optionObject,
			applyKeys: applyKeys,
			filter: filter,
			transformation: transformation
		};
	}

	throw new InsightError("Invalid Query String");
}

/**
 * Returns a FilterObject based on the where Filter passed in
 * @param where The where filter in the query
 * @param dataset The name of the dataset being queried against
 * @param applyKeys The applyKeys in the query
 *
 * @return FilterObject
 *
 * This function will throw an InsightError if the Filter is poorly formatted.
 */
function getFilterObjectFromFilter(where: Filter, dataset: InsightDataset, applyKeys: string[]): FilterObject {
	if (Object.keys(where).length > 1) {
		throw new InsightError(`WHERE should only have 1 key, has ${Object.keys(where).length}`);
	}

	if (where.AND !== null && where.AND !== undefined) {
		return getLogicOperatorFilterObject(where.AND, dataset, Operators.AND, applyKeys);
	} else if (where.OR !== null && where.OR !== undefined) {
		return getLogicOperatorFilterObject(where.OR, dataset, Operators.OR, applyKeys);
	} else if (where.NOT !== null && where.NOT !== undefined) {
		return getSingleLogicOperatorFilterObject(where.NOT, dataset, Operators.NOT, applyKeys);
	} else if (where.GT !== null && where.GT !== undefined) {
		return getComparisonFilterObject(where.GT, dataset, Operators.GT, applyKeys);
	} else if (where.LT !== null && where.LT !== undefined) {
		return getComparisonFilterObject(where.LT, dataset, Operators.LT, applyKeys);
	} else if (where.IS !== null && where.IS !== undefined) {
		return getComparisonFilterObject(where.IS, dataset, Operators.IS, applyKeys);
	} else if (where.EQ !== null && where.EQ !== undefined) {
		return getComparisonFilterObject(where.EQ, dataset, Operators.EQ, applyKeys);
	}

	throw new InsightError("WHERE clause is improperly formatted");
}

/**
 * Returns a FilterObject based on the where Filter passed in
 * @param option The options filter in the query. Must have been validated before the call to this function
 * @param dataset The name of the dataset being queried against
 *
 * @return FilterObject
 *
 * This function will throw an InsightError if the Filter is poorly formatted.
 */
function getOptionsObjectFromOptions(option: Options, dataset: InsightDataset): OptionObject {
	let columns: string[] = option.COLUMNS.map((c) => getColumnFromKey(c));
	let order: string | Order | undefined = option.ORDER;

	let orderObject: string | OrderObject | undefined;
	if (order !== undefined && typeof order === "object") {
		let direction: Direction = order.dir === "UP" ? Direction.UP : Direction.DOWN;
		orderObject = {
			dir: direction,
			keys: order.keys.map((key) => getColumnFromKey(key))
		};

	} else if (order !== undefined) {
		orderObject = getColumnFromKey(order);
	}

	return {
		columns: columns,
		order: orderObject

	};
}

/**
 * gets the column from the given key that contains a dataset or is an apply key
 * @param key
 */
function getColumnFromKey(key: string): string {
	let split = key.split("_");
	if (split.length === 1) {
		return split[0];
	}
	return split[1];
}

/**
 * Returns a FilterObject based on a logic operator (LOGICOPERATOR)
 * @param filters The filters that come with the logic operator (i.e where.AND, where.OR, etc.)
 * @param dataset The name of the dataset
 * @param operator The logic operator
 * @param applyKeys The applyKeys in the query
 */
function getLogicOperatorFilterObject(filters: Filter[], dataset: InsightDataset, operator: Operators,
									  applyKeys: string[]): LogicFilter {
	if (!Array.isArray(filters) || filters.length === 0) {
		throw new InsightError(`${operator} must be a non-empty array`);
	}
	let extraOperators: FilterObject[] = [];
	filters.forEach((t) => extraOperators.push(getFilterObjectFromFilter(t, dataset, applyKeys)));

	return {
		operator: operator,
		ExtraOperators: extraOperators
	};
}

/**
 * Returns a FilterObject based on a comparison filter (SCOMPARISON or MCOMPARISON)
 * @param keyValue The key-value pair for the comparison (i.e where.GT, where.LT, etc.)
 * @param dataset The name of the dataset
 * @param operator The operator of the comparison
 * @param applyKeys The applykeys in the query
 *
 * Will check if the key properly references the dataset
 * The string must have the correct number of keys
 */
function getComparisonFilterObject(keyValue: MKeyValue | SKeyValue, dataset: InsightDataset,
								   operator: Operators, applyKeys: string[]): ConditionalFilter {
	let keys: string[] = Object.keys(keyValue);
	if (keys.length !== 1) {
		throw new InsightError(`${operator} must have one key`);
	}

	let keyWithDatabase: string = keys[0];
	validateColumn(keyWithDatabase, dataset, operator, applyKeys);
	let splitKey = keyWithDatabase.split("_");

	if (mfield.includes(splitKey[1])) {
		if (!["GT", "LT", "EQ"].includes(operator)) {
			throw new InsightError(`Invalid key type in ${operator}`);
		}
		if (typeof keyValue[keyWithDatabase] !== "number") {
			throw new InsightError(`Invalid value type in ${operator}`);
		}
	} else {
		if (!["IS"].includes(operator)) {
			throw new InsightError(`Invalid key type in ${operator}`);
		}
		if (typeof keyValue[keyWithDatabase] !== "string") {
			throw new InsightError(`Invalid value type in ${operator}`);
		}
	}

	if (operator === "IS") {
		let input = keyValue[keyWithDatabase];
		if (typeof input === "string") {
			let size = input.length;
			if (size > 1) {
				let index = input.indexOf("*", 1);

				if (index !== size - 1 && index !== -1) {
					throw new InsightError("Asterisks (*) must be at start or end of input string");
				}
			}
		}
	}

	return {
		operator: operator,
		key: splitKey[1],
		value: keyValue[keyWithDatabase]
	};
}

/**
 * Returns a LogicFilter based on a single logic operator (ex. NOT)
 * @param where the filter associated with the logic operator (i.e. where.NOT)
 * @param dataset the name of the dataset
 * @param operator the operator calling this function
 * @param applyKeys The applyKeys in the query
 */
function getSingleLogicOperatorFilterObject(where: Filter, dataset: InsightDataset, operator: Operators,
	applyKeys: string[]): LogicFilter {
	if (typeof where !== "object") {
		throw new InsightError(`${operator} must not be empty`);
	}
	return {
		operator: operator,
		ExtraOperators: [getFilterObjectFromFilter(where, dataset, applyKeys)]
	};
}

/**
 * Returns the name of the database based on a well formatted query. Throws an error if the dataset has not yet been added
 * @param query a well formatted query (passed through isQuery)
 * @param datasets datasets returned by InsightFacade.listDatasets()
 * @return string
 */
function getDatasetFromQuery(query: Query, datasets: InsightDataset[]): InsightDataset {
	let splitString = query.OPTIONS.COLUMNS[0].split("_");
	let found = datasets.find((dataset) => dataset.id === splitString[0]);

	if (found === undefined) {
		throw new InsightError(`Dataset ${splitString[0]} not added yet`);
	}

	return found;
}

/**
 * Takes the transformation part of the query and changes it to a TransformationObject. Also does extra validation.
 *
 * @param transformation The transformation part of the query.
 * @param dataset The dataset.
 */
export function getTransformationObjectFromQuery(transformation: Transformation,
												 dataset: InsightDataset): TransformationObject | undefined {
	if (transformation === null || transformation === undefined) {
		return undefined;
	}

	let applyRuleObjects: ApplyRuleObject[] = [];
	transformation.APPLY.forEach((applyRules) => {
		let key = Object.keys(applyRules)[0];
		let applyRule: ApplyRule = applyRules[key];
		let tokens = Object.keys(applyRule);
		if (tokens.length !== 1) {
			throw new InsightError(`Apply body should have 1 key, has ${tokens.length}`);
		}
		let token: ApplyTokens = tokens[0] as ApplyTokens;
		let column = Object.entries(applyRule).find(([tokenToFind]) => tokenToFind === token)?.at(1);
		validateColumn(column, dataset, "APPLY", []);

		let columnNoDataset: string = getColumnFromKey(column);

		validateTokenAndColumn(columnNoDataset, token);

		applyRuleObjects.push({
			applyKey: key,
			applyToken: token,
			column: columnNoDataset
		});
	});

	let columns: string[] = transformation.GROUP.map((column) => getColumnFromKey(column));

	return {
		apply: applyRuleObjects,
		group: columns
	};
}
