import {InsightResult} from "../controller/IInsightFacade";
import Decimal from "decimal.js";

/**
 * Gets the average for the column in the group
 *
 * @param group
 * @param column must be an mfield
 */
export function getAverage(group: InsightResult[], column: string): number {
	let rsf: Decimal = new Decimal(0);
	group.forEach((result) => {
		rsf = rsf.add(new Decimal(result[column]));
	});
	let avg = rsf.toNumber() / group.length;
	return Number(avg.toFixed(2));
}

/**
 * Gets the max for the column in the group
 *
 * @param group
 * @param column must be an mfield
 */
export function getMax(group: InsightResult[], column: string): number {
	let max: number = Number.MIN_VALUE;
	group.forEach((result) => {
		let num: number = result[column] as number; // result[column] will always be a number
		max = max > num ? max : num;
	});
	return max;
}

/**
 * Gets the min for the column in the group
 *
 * @param group
 * @param column
 */
export function getMin(group: InsightResult[], column: string): number {
	let min: number = Number.MAX_VALUE;
	group.forEach((result) => {
		let num: number = result[column] as number; // result[column] will always be a number
		min = min < num ? min : num;
	});
	return min;
}

/**
 * Gets the count of the column in the group
 *
 * @param group
 * @param column
 */
export function getCount(group: InsightResult[], column: string): number {
	let seen: any[] = [];
	let rsf = 0;
	group.forEach((result) => {
		let val = result[column];
		if (!seen.includes(val)) {
			rsf++;
			seen.push(val);
		}
	});
	return rsf;
}

/**
 * Gets the sum for the column in the group
 *
 * @param group
 * @param column must be an mfield
 */
export function getSum(group: InsightResult[], column: string): number {
	let rsf = 0;
	group.forEach((result) => {
		let val: number = result[column] as number;
		rsf += val;
	});
	return Number(rsf.toFixed(2));
}
