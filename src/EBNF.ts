// Allowed column names
export const sectionssfield: string[] = [
	"dept",
	"id",
	"instructor",
	"title",
	"uuid"
];

export const sectionsmfield: string[] = [
	"avg",
	"pass",
	"fail",
	"audit",
	"year"
];

export const roomssfield: string[] = [
	"fullname",
	"shortname",
	"number",
	"name",
	"address",
	"type",
	"furniture",
	"href"
];

export const roomsmfield: string[] = [
	"lat",
	"lon",
	"seats"
];

export const sfield: string[] = [... sectionssfield, ... roomssfield];

export const mfield: string[]  = [... sectionsmfield, ... roomsmfield];


export interface Query {
	WHERE: Filter,
	OPTIONS: Options,
	TRANSFORMATIONS: Transformation
}
export const queryColumns: string[] = ["WHERE", "OPTIONS", "TRANSFORMATIONS"];

export interface Filter {
	NOT?: Filter,
	AND?: Filter[],
	OR?: Filter[],
	GT?: MKeyValue,
	LT?: MKeyValue,
	EQ?: MKeyValue,
	IS?: SKeyValue
}

export interface MKeyValue {
	[mkey: string]: number // check mkey
}

export interface SKeyValue {
	[skey: string]: string // check skey
}

export interface Options {
	COLUMNS: string[] // Manual check
	ORDER: string | Order | undefined // same check
}

export interface Order {
	dir: string,
	keys: string[]
}

export enum Direction {
	UP = 1,
	DOWN = -1
}
export const options: string[] = ["COLUMNS", "ORDER"];


export interface Transformation {
	GROUP: string[],
	APPLY: ApplyRules[]
}

export interface ApplyRules {
	[applyKey: string]: ApplyRule
}

export interface ApplyRule { // check keys
	MAX: string,
	MIN: string,
	AVG: string,
	COUNT: string,
	SUM: string
}
export const transformations: string[] = ["GROUP", "APPLY"];
