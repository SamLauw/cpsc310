import {InsightDataset} from "./controller/IInsightFacade";
import {Direction} from "./EBNF";

export interface QueryObject {
	database: InsightDataset,
	applyKeys: string[],
	filter?: FilterObject,
	options: OptionObject,
	transformation?: TransformationObject
}

export interface ConditionalFilter extends FilterObject {
	key: string,
	value: string | number
}

export interface LogicFilter extends FilterObject {
	ExtraOperators: FilterObject[]
}

export interface FilterObject {
	operator: Operators
}

export interface OptionObject {
	columns: string[],
	order: string | OrderObject | undefined
}

export interface OrderObject {
	dir: Direction,
	keys: string[]
}

export interface TransformationObject {
	group: string[],
	apply: ApplyRuleObject[]
}

export interface ApplyRuleObject {
	applyKey: string,
	applyToken: ApplyTokens,
	column: string
}

export enum Operators {
	AND = "AND",
	OR = "OR",
	NOT = "NOT",
	LT = "LT",
	GT = "GT",
	EQ = "EQ",
	IS = "IS"
}

export enum ApplyTokens {
	MAX = "MAX",
	MIN = "MIN",
	AVG = "AVG",
	COUNT = "COUNT",
	SUM = "SUM"
}

export const validTokens: ApplyTokens[] =
	[ApplyTokens.MAX, ApplyTokens.MIN, ApplyTokens.AVG, ApplyTokens.COUNT, ApplyTokens.SUM];

export const logicOperators: Operators[] = [Operators.NOT, Operators.AND, Operators.OR];

export const conditionalOperators: Operators[] = [Operators.EQ, Operators.IS, Operators.GT, Operators.LT];
