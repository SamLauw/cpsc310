import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";

import * as fs from "fs-extra";

import {folderTest} from "@ubccpsc310/folder-test";

import chai, {expect} from "chai";
import chaiAsPromised from "chai-as-promised";
import {clearDisk, getContentFromArchives} from "../TestUtil";
import {fail} from "assert";

chai.use(chaiAsPromised);

const isC1Test: boolean = process.env.npm_config_checkpoint !== undefined && process.env.npm_config_checkpoint === "1";

/**
 * skips all the tests in c2 test if run using yarn c1test
 */
// describe("c2 test", function () {
// 	before(function() {
// 		if (isC1Test) {
// 			this.skip();
// 		}
// 	});
//
// 	it("Should not run", () => {
// 		console.log("It ran");
// 		fail();
// 	});
// });

// region Basic Given Tests
describe("InsightFacade", function () {
	let insightFacade: InsightFacade;
	let sections: string;
	let someValidCourses: string;

	const persistDirectory = "./data";
	const datasetContents = new Map<string, string>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		sections: "./test/resources/archives/pair.zip",
	};

	before(function () {
		// This section runs once and loads all datasets specified in the datasetsToLoad object
		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]).toString("base64");
			datasetContents.set(key, content);
		}
		// Just in case there is anything hanging around from a previous run of the test suite
		fs.removeSync(persistDirectory);
		sections = getContentFromArchives("givenTestFile.zip");
		someValidCourses = getContentFromArchives("someValidCourses.zip");
	});

	describe("Add/Remove/List Dataset", function () {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);
		});

		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			console.info(`BeforeTest: ${this.currentTest?.title}`);
			insightFacade = new InsightFacade();
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});

		afterEach(function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			console.info(`AfterTest: ${this.currentTest?.title}`);
			fs.removeSync(persistDirectory);
		});

		// This is a unit test. You should create more like this!
		it("Should add a valid dataset", function () {
			const id: string = "sections";
			const content: string = datasetContents.get("sections") ?? "";
			const expected: string[] = [id];
			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then((result: string[]) => expect(result).to.deep.equal(expected));
		});
	});

	/*
	 * This test suite dynamically generates tests from the JSON files in test/resources/queries.
	 * You should not need to modify it; instead, add additional files to the queries directory.
	 * You can still make tests the normal way, this is just a convenient tool for a majority of queries.
	 */
	describe("PerformQuery", () => {
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);

			insightFacade = new InsightFacade();

			// Load the datasets specified in datasetsToQuery and add them to InsightFacade.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises = [
				insightFacade.addDataset(
					"sections",
					datasetContents.get("sections") ?? "",
					InsightDatasetKind.Sections
				),
			];

			return Promise.all(loadDatasetPromises);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
			fs.removeSync(persistDirectory);
		});

		// Assert value equals expected
		function assertResult(actual: any, expected: InsightResult[]): void {
			expect(actual).to.have.deep.members(expected);
		}

		type PQErrorKind = "ResultTooLargeError" | "InsightError";

		folderTest<unknown, Promise<InsightResult[]>, PQErrorKind>(
			"Dynamic InsightFacade PerformQuery tests",
			(input) => insightFacade.performQuery(input),
			"./test/resources/queries",
			{
				assertOnResult: assertResult,
				errorValidator: (error): error is PQErrorKind =>
					error === "ResultTooLargeError" || error === "InsightError",
				assertOnError: (actual, expected) => {
					if (expected === "ResultTooLargeError") {
						expect(actual).to.be.instanceof(ResultTooLargeError);
					} else {
						expect(actual).to.be.instanceof(InsightError);
					}
				},
			}
		);
	});
});
// endregion

// region old tests Elton
describe("InsightFacade Elton", function () {
	let facade: IInsightFacade;
	let sections: string;
	let someValidCourses: string;
	let someValidRooms: string;
	let rooms: string;

	before( function() {
		sections = getContentFromArchives("givenTestFile.zip");
		rooms = getContentFromArchives("rooms.zip");
		someValidRooms = getContentFromArchives("someRoomsWithMissingBuildings.zip");
		someValidCourses = getContentFromArchives("someValidCourses.zip");
	});

	beforeEach( function() {
		// This section resets the insightFacade instance
		// This runs before each test
		console.info(`BeforeTest: ${this.currentTest?.title}`);
		clearDisk();
		facade = new InsightFacade();
	});

	afterEach(function() {
		console.info(`AfterTest: ${this.currentTest?.title}`);
	});

	describe("list databases", function () {

		it("should throw an error no courses", function() {
			return expect(facade.addDataset("no-courses", getContentFromArchives("noCourses.zip"),
				InsightDatasetKind.Sections)).to.eventually.be.rejectedWith(InsightError);
		});

		it("should throw an error no valid courses", function() {
			return expect(facade.addDataset("no-valid-courses", getContentFromArchives("invalidCourse.zip"),
				InsightDatasetKind.Sections)).to.eventually.be.rejectedWith(InsightError);
		});

		it("should have 1 row", function() {
			return facade.addDataset("one-valid-course", getContentFromArchives("oneValidCourse.zip"),
				InsightDatasetKind.Sections).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					expect(insightDatasets).to.deep.equal([{
						id: "one-valid-course",
						kind: InsightDatasetKind.Sections,
						numRows: 1
					}]);
				}));
			});
		});

		it ("should list no databases", function () {
			return facade.listDatasets().then(((insightDatasets) => {
				expect(insightDatasets).to.deep.equal([]);

				expect(insightDatasets).to.be.an.instanceof(Array);
				expect(insightDatasets).to.have.length(0);
			}));
		});

		it ("should list one sections database", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.listDatasets();
			}).then((insightDatasets) => {
				expect(insightDatasets).to.deep.equal([{
					id: "sections",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}]);
			});
		});

		it ("should list two databases", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections)
				.then(() => {
					return facade.addDataset("sections-2", someValidCourses, InsightDatasetKind.Sections);
				})
				.then(() => {
					return facade.listDatasets();
				}).then((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						},
						{
							id: "sections-2",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						}
					];
					expect(insightDatasets).to.deep.equal(expectedDatasets);
				});
		});

		it("should fail on duplicate id", function() {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return expect(facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections))
					.eventually.to.be.rejectedWith(InsightError);
			}
			);
		});

		it("should fail on whitespace id", function() {
			return expect(facade.addDataset("  ", sections, InsightDatasetKind.Sections))
				.eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on empty id", function() {
			return expect(facade.addDataset("", sections, InsightDatasetKind.Sections))
				.eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on underscore in id", function() {
			return expect(facade.addDataset("thisNameIsCompletelyFine_I_Think", sections,
				InsightDatasetKind.Sections)).eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on empty zip", function() {
			return expect(facade.addDataset("empty", getContentFromArchives("noFolderZip.zip"),
				InsightDatasetKind.Sections)).eventually.to.be.rejectedWith(InsightError);
		});
	});

	describe("room tests", function() {
		it("should fail on empty zip rooms", function() {
			return expect(facade.addDataset("empty",
				getContentFromArchives("noFolderZip.zip"), InsightDatasetKind.Rooms)).
				eventually.to.be.rejectedWith(InsightError);
		});

		it("should have 1 row", function() {
			return facade.addDataset("oneRoom", getContentFromArchives("oneValidRoom.zip"),
				InsightDatasetKind.Rooms).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					expect(insightDatasets).to.deep.equal([{
						id: "oneRoom",
						kind: InsightDatasetKind.Rooms,
						numRows: 61
					}]);
				}));
			});
		});

		it ("should have 2 room databases", function () {
			return facade.addDataset("rooms1", someValidRooms, InsightDatasetKind.Rooms)
				.then(() => {
					return facade.addDataset("rooms", someValidRooms, InsightDatasetKind.Rooms);
				})
				.then(() => {
					return facade.listDatasets();
				}).then((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "rooms1",
							kind: InsightDatasetKind.Rooms,
							numRows: 8
						},
						{
							id: "rooms",
							kind: InsightDatasetKind.Rooms,
							numRows: 8
						}
					];
					expect(insightDatasets).to.deep.equal(expectedDatasets);
				});
		});

		it("should fail on no discover folder", function() {
			return expect(facade.addDataset("no-discover-folder.zip", getContentFromArchives("noDiscover.zip"),
				InsightDatasetKind.Rooms)).eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on no buildings-and-classroom folder folder", function() {
			return expect(facade.addDataset("no-buildings-folder", getContentFromArchives("noBuildings.zip"),
				InsightDatasetKind.Rooms)).eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on empty htm file", function() {
			return expect(facade.addDataset("empty-htm", getContentFromArchives("emptyHtmFile.zip"),
				InsightDatasetKind.Rooms)).eventually.to.be.rejectedWith(InsightError);
		});

		it("should fail on no index file", function() {
			return expect(facade.addDataset("no-index-htm", getContentFromArchives("noIndex.zip"),
				InsightDatasetKind.Rooms)).eventually.to.be.rejectedWith(InsightError);
		});
	});

	describe("mixed tests", function() {
		it ("should have course and room databases", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections)
				.then(() => {
					return facade.addDataset("rooms", rooms, InsightDatasetKind.Rooms);
				})
				.then(() => {
					return facade.listDatasets();
				}).then((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						},
						{
							id: "rooms",
							kind: InsightDatasetKind.Rooms,
							numRows: 364
						}
					];
					expect(insightDatasets).to.deep.equal(expectedDatasets);
				});
		});

		it("should remove the correct database remove rooms", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.addDataset("rooms", someValidRooms, InsightDatasetKind.Rooms);
			}).then(() => {
				return facade.removeDataset("rooms");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						}
					];
					return expect(insightDatasets).to.deep.equal(expectedDatasets);
				}));
			});
		});

		it("should remove the correct database remove sections", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.addDataset("rooms", someValidRooms, InsightDatasetKind.Rooms);
			}).then(() => {
				return facade.removeDataset("sections");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "rooms",
							kind: InsightDatasetKind.Rooms,
							numRows: 8
						}
					];
					return expect(insightDatasets).to.deep.equal(expectedDatasets);
				}));
			});
		});
	});

	describe("remove databases", function () {

		it("should remove the correct database remove second", function () {
			return facade.addDataset("sections1", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.addDataset("sections2", someValidCourses, InsightDatasetKind.Sections);
			}).then(() => {
				return facade.removeDataset("sections2");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections1",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						}
					];
					return expect(insightDatasets).to.deep.equal(expectedDatasets);
				}));
			});
		});

		it("should remove the database", function () {
			return facade.addDataset("sections", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.removeDataset("sections");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					expect(insightDatasets).to.deep.equal([]);
					expect(insightDatasets).to.be.an.instanceof(Array);
					expect(insightDatasets).to.have.length(0);
				}));
			});
		});


		it("should remove the correct database remove first", function () {
			return facade.addDataset("sections1", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.addDataset("sections2", someValidCourses, InsightDatasetKind.Sections);
			}).then(() => {
				return facade.removeDataset("sections1");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections2",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						}
					];
					return expect(insightDatasets).to.deep.equal(expectedDatasets);
				}));
			});
		});

		it("should remove the correct database not able to query", function () {
			return facade.addDataset("sections1", someValidCourses, InsightDatasetKind.Sections).then(() => {
				return facade.addDataset("sections2", someValidCourses, InsightDatasetKind.Sections);
			}).then(() => {
				return facade.removeDataset("sections1");
			}).then(() => {
				return facade.listDatasets().then(((insightDatasets) => {
					const expectedDatasets: InsightDataset[] = [
						{
							id: "sections2",
							kind: InsightDatasetKind.Sections,
							numRows: 4
						}
					];
					return expect(insightDatasets).to.deep.equal(expectedDatasets);
				}));
			}).then(() => {
				let promise = facade.performQuery({
					WHERE: {
						GT: {
							sections1_avg: 98
						}
					},
					OPTIONS: {
						COLUMNS: [
							"sections1_dept",
							"sections1_id",
							"sections1_avg",
							"sections1_title",
							"sections1_pass",
							"sections1_fail",
							"sections1_audit",
							"sections1_year",
							"sections1_instructor",
							"sections1_uuid"
						],
						ORDER: "sections1_year"
					}
				});
				return expect(promise).to.eventually.be.rejectedWith(InsightError);
			});
		});

		it("should throw not find the dataset", function() {
			return expect(facade.removeDataset("sections")).eventually.to.be.rejectedWith(NotFoundError);
		});

		it("should throw an error with invalid id", function() {
			return expect(facade.removeDataset("__")).eventually.to.be.rejectedWith(InsightError);
		});

		it("should throw an error with whitespace", function() {
			return expect(facade.removeDataset("  ")).eventually.to.be.rejectedWith(InsightError);
		});
	});
});

interface Input { query: string }
type Output = Promise<InsightResult[]>;
type Error = "InsightError" | "ResultTooLargeError";

function resolveQuery(input: Input, facade: IInsightFacade): Promise<InsightResult[]> {
	return facade.performQuery(input);
}

describe("Dynamic folder test", function () {
	let facade: IInsightFacade;
	let sections: string;
	let ubc: string;

	before(function () {
		facade = new InsightFacade();
		clearDisk();
		sections = getContentFromArchives("givenTestFile.zip");
		ubc = getContentFromArchives("ubc.zip");
		return facade.addDataset("sections", sections, InsightDatasetKind.Sections).then(() =>
			facade.addDataset("ubc", ubc, InsightDatasetKind.Sections));
	});

	// Assert value equals expected
	function assertResult(actual: any, expected: InsightResult[]): void {
		expect(actual).to.have.deep.members(expected);
	}

	// Assert actual error is of expected type
	function assertError(actual: any, expected: Error): void {
		if (expected === "InsightError") {
			expect(actual).to.be.an.instanceof(InsightError);
		} else if (expected === "ResultTooLargeError") {
			expect(actual).to.be.an.instanceof(ResultTooLargeError);
		} else {
			fail("Unknown Error");
		}
	}

	folderTest<Input, Output, Error>(
		"Passing Queries",                               // suiteName
		(input: Input): Output => resolveQuery(input, facade),      // target
		"./test/resources/folder-test/passing-tests",                   // path
		{
			assertOnResult: assertResult,
			assertOnError: assertError,                 // options
		}
	);

	folderTest<Input, Output, Error>(
		"InsightError Queries",                               // suiteName
		(input: Input): Output => resolveQuery(input, facade),      // target
		"./test/resources/folder-test/insightError-tests",                   // path
		{
			assertOnResult: assertResult,
			assertOnError: assertError,                 // options
		}
	);

	folderTest<Input, Output, Error>(
		"ResultTooLarge Queries",                               // suiteName
		(input: Input): Output => resolveQuery(input, facade),      // target
		"./test/resources/folder-test/resultTooLarge-tests",                   // path
		{
			assertOnResult: assertResult,
			assertOnError: assertError,                 // options
		}
	);
});
// endregion

// region updated tests Elton
describe("Elton upgraded tests", function() {
	// region setup
	let insightFacade: InsightFacade;

	const archiveDirectory = "./test/resources/archives";
	const datasetContents = new Map<string, string>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		sections: `${archiveDirectory}/pair.zip`,
		ubc: `${archiveDirectory}/ubc.zip`,
		someValidCourses: `${archiveDirectory}/someValidCourses.zip`, // 4 rows
		someValidCoursesAndRooms: `${archiveDirectory}/someValidCoursesAndRooms.zip`, // 4 section rows, 364 rooms
		someRoomsWithMissingBuildings: `${archiveDirectory}/someRoomsWithMissingBuildings.zip`
	};

	before(function () {
		// This section runs once and loads all datasets specified in the datasetsToLoad object
		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]).toString("base64");
			datasetContents.set(key, content);
		}
		// Just in case there is anything hanging around from a previous run of the test suite
	});

	beforeEach(function () {
		// This section resets the insightFacade instance
		// This runs before each test
		console.info(`BeforeTest: ${this.currentTest?.title}`);
		clearDisk();
		insightFacade = new InsightFacade();
	});


	afterEach(function () {
		// This section resets the data directory (removing any cached data)
		// This runs after each test, which should make each test independent of the previous one
		console.info(`AfterTest: ${this.currentTest?.title}`);
	});

	// endregion

	// region Add Dataset
	describe("Add Dataset", function() {

		// region setup
		before(function() {
			console.info(`Before: ${this.test?.parent?.title}`);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});
		// endregion

		it("should add a dataset", () => {
			const id: string = "sections";
			const content: string = datasetContents.get("someValidCourses") ?? "";
			const expected: string[] = [id];
			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then((result) => expect(result).to.deep.equal(expected));
		});

		it("should add two datasets", () => {
			const id1: string = "sections";
			const id2: string = "ubc";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const content2: string = datasetContents.get("someValidCourses") ?? "";
			const expectedIds: string[] = [id1, id2];
			const expectedList: InsightDataset[] = [
				{
					id: "sections",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				},
				{
					id: "ubc",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Sections))
				.then((result) => expect(result).to.have.deep.members(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("should reject on empty dataset", function() {
			const id: string = "empty";
			const content: string = getContentFromArchives("noFolderZip.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on no course folder", function() {
			const id: string = "noCourseFolder";
			const content: string = getContentFromArchives("noCourseFolder.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on no courses", function() {
			const id: string = "noCourses";
			const content: string = getContentFromArchives("noCourses.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on invalid courses", function() {
			const id: string = "noValidCourses";
			const content: string = getContentFromArchives("noValidCourses.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should add valid courses", function() {
			const id: string = "courses";
			const content: string = datasetContents.get("someValidCourses") ?? "";
			const expected: InsightDataset[] = [
				{
					id: id,
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expected));
		});

		it("should reject on empty dataset name", function() {
			const id: string = "";
			const content: string = getContentFromArchives("pair.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on whitespace dataset name", function() {
			const id: string = "       ";
			const content: string = getContentFromArchives("pair.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on underscore in dataset name", function() {
			const id: string = "_";
			const content: string = getContentFromArchives("pair.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with empty content", function() {
			const id: string = "invalidContent";
			const content: string = "";

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with random content", function() {
			const id: string = "invalidContent";
			const content: string = "ThisContainsSomeContentThatIsNotAFile";

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with random base64 content", function() {
			const id: string = "invalidContent";
			const content: string = "UEsDBAoAAAAAAHNdKUoAAAAAAAAAAAAAAAAIABAAY291cnNlcy9VWAwAC" +
				"utzWOrnc1j2ARQAUEsDBBQACAAIAARUKUoAAAAAAAAA";

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject with corrupted content", function() {
			const id: string = "invalidContent";
			const content: string = getContentFromArchives("corruptedFile.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject on underscore in dataset name 2", function() {
			const id: string = "this_is_a_name";
			const content: string = getContentFromArchives("pair.zip");

			let promise = insightFacade.addDataset(id, content, InsightDatasetKind.Sections);
			return expect(promise).to.eventually.be.rejectedWith(InsightError);
		});

		it("should reject the duplicated in dataset id keep first", function() {
			const id: string = "sections";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const content2: string = datasetContents.get("sections") ?? "";
			const expectedList: InsightDataset[] = [
				{
					id: "sections",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];

			let promise = insightFacade.addDataset(id, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id, content2, InsightDatasetKind.Sections));

			return expect(promise).to.eventually.be.rejectedWith(InsightError)
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedList));
		});

	});
	// endregion

	// region Remove Dataset
	describe("Remove Dataset", function() {
		// region setup
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});
		// endregion

		it("should remove the dataset", () => {
			const id1: string = "sections";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const expectedList: InsightDataset[] = [];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.removeDataset(id1))
				.then((result) => expect(result).to.deep.equal(id1))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("should remove the dataset when added again", () => {
			const id1: string = "sections";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const expectedList: InsightDataset[] = [];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.removeDataset(id1))
				.then((result) => expect(result).to.deep.equal(id1))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList))
				.then(() => insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections))
				.then(() => insightFacade.removeDataset(id1))
				.then((result) => expect(result).to.deep.equal(id1))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("should fail to remove the dataset twice", () => {
			const id1: string = "sections";
			const id2: string = "ubc";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const content2: string = datasetContents.get("ubc") ?? "";
			const expectedList: InsightDataset[] = [
				{
					id: "sections",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Sections))
				.then(() => insightFacade.removeDataset(id2))
				.then((result) => expect(result).to.deep.equal(id2))
				.then(() => expect(insightFacade.removeDataset("ubc")).to.eventually.be.rejectedWith(NotFoundError))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("should fail to remove the first dataset", () => {
			const id1: string = "sections";
			const id2: string = "ubc";
			const content1: string = datasetContents.get("sections") ?? "";
			const content2: string = datasetContents.get("someValidCourses") ?? "";
			const expectedList: InsightDataset[] = [
				{
					id: "ubc",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Sections))
				.then(() => insightFacade.removeDataset(id1))
				.then((result) => expect(result).to.deep.equal(id1))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("should fail to remove the second dataset", () => {
			const id1: string = "sections";
			const id2: string = "ubc";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const content2: string = datasetContents.get("ubc") ?? "";
			const expectedList: InsightDataset[] = [
				{
					id: "sections",
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}];
			return insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Sections))
				.then(() => insightFacade.removeDataset(id2))
				.then((result) => expect(result).to.deep.equal(id2))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("cannot remove a dataset that does not exist", () => {
			const id1: string = "sections";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const expectedList: InsightDataset[] = [{
				id: id1,
				kind: InsightDatasetKind.Sections,
				numRows: 4
			}];
			return expect(insightFacade.removeDataset("ubc")).to.eventually.be.rejectedWith(NotFoundError)
				.then(() => insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections))
				.then(() => expect(insightFacade.removeDataset("ubc")).to.eventually.be.rejectedWith(NotFoundError))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

		it("cannot remove a dataset that has an invalid name", () => {
			const id1: string = "sections";
			const content1: string = datasetContents.get("someValidCourses") ?? "";
			const expectedList: InsightDataset[] = [{
				id: id1,
				kind: InsightDatasetKind.Sections,
				numRows: 4
			}];
			return expect(insightFacade.removeDataset("Hello_Hello")).to.eventually.be.rejectedWith(InsightError)
				.then(() => insightFacade.addDataset(id1, content1, InsightDatasetKind.Sections))
				.then(() => expect(insightFacade.removeDataset("___")).to.eventually.be.rejectedWith(InsightError))
				.then(() => expect(insightFacade.removeDataset("")).to.eventually.be.rejectedWith(InsightError))
				.then(() => expect(insightFacade.removeDataset("  ")).to.eventually.be.rejectedWith(InsightError))
				.then(() => expect(insightFacade.removeDataset("This_Is_An_Invalid_Name"))
					.to.eventually.be.rejectedWith(InsightError))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.have.deep.members(expectedList));
		});

	});
	// endregion

	// region List Dataset
	describe("List Dataset", function() {

		// region setup
		before(function () {
			console.info(`Before: ${this.test?.parent?.title}`);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});
		// endregion

		it("should not list any datasets", () => {
			let expected: InsightDataset[] = [];

			return insightFacade.listDatasets().then((res) => expect(res).to.deep.members(expected));
		});

		it("should list a dataset", () => {
			let id: string = "sections";
			let content: string = datasetContents.get("someValidCourses") ?? "";
			let expected: InsightDataset[] = [
				{
					id: id,
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}
			];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then(() => insightFacade.listDatasets())
				.then((res) => expect(res).to.deep.members(expected));
		});

		it("should list multiple datasets", () => {
			let id: string = "sections";
			let content: string = datasetContents.get("sections") ?? "";
			let id2: string = "someValidCourses";
			let content2: string = datasetContents.get("someValidCourses") ?? "";
			let expected: InsightDataset[] = [
				{
					id: id,
					kind: InsightDatasetKind.Sections,
					numRows: 64612
				},
				{
					id: id2,
					kind: InsightDatasetKind.Sections,
					numRows: 4
				}
			];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Sections))
				.then(() => insightFacade.listDatasets())
				.then((res) => expect(res).to.deep.members(expected));
		});

	});
	// endregion

	// region c2 tests
	describe("c2 tests", function () {
		// region setup
		before(function() {
			if (isC1Test) {
				this.skip();
				console.info("C2 Tests were skipped");
			}

			console.info(`Before: ${this.test?.parent?.title}`);
		});

		after(function () {
			console.info(`After: ${this.test?.parent?.title}`);
		});
		// endregion

		it("should add the courses dataset", () => {
			let id: string = "sections";
			let content: string = datasetContents.get("someValidCoursesAndRooms") ?? "";
			let expectedIds: string[] = ["sections"];
			let expectedInsightDataset: InsightDataset[] = [{
				id: "sections",
				kind: InsightDatasetKind.Sections,
				numRows: 4
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("should add the rooms dataset", () => {
			let id: string = "rooms";
			let content: string = datasetContents.get("someValidCoursesAndRooms") ?? "";
			let expectedIds: string[] = ["rooms"];
			let expectedInsightDataset: InsightDataset[] = [{
				id: "rooms",
				kind: InsightDatasetKind.Rooms,
				numRows: 364
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Rooms)
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("should add both rooms dataset", () => {
			let id: string = "rooms";
			let content: string = datasetContents.get("someValidCoursesAndRooms") ?? "";
			let id2: string = "rooms2";
			let content2: string = datasetContents.get("someRoomsWithMissingBuildings") ?? "";
			let expectedIds: string[] = ["rooms", "rooms2"];
			let expectedInsightDataset: InsightDataset[] = [{
				id: "rooms",
				kind: InsightDatasetKind.Rooms,
				numRows: 364
			},
			{
				id: "rooms2",
				kind: InsightDatasetKind.Rooms,
				numRows: 8
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Rooms)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Rooms))
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("should add only rooms with proper address", () => {
			let id2: string = "rooms2";
			let content2: string = getContentFromArchives("emptyAddressBuilding.zip");
			let expectedInsightDataset: InsightDataset[] = [
				{
					id: id2,
					kind: InsightDatasetKind.Rooms,
					numRows: 8
				}];
			return insightFacade.addDataset(id2, content2, InsightDatasetKind.Rooms)
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("should add the sections and rooms dataset", () => {
			let id: string = "sections";
			let content: string = datasetContents.get("someValidCourses") ?? "";
			let id2: string = "rooms2";
			let content2: string = datasetContents.get("someRoomsWithMissingBuildings") ?? "";
			let expectedIds: string[] = [id, id2];
			let expectedInsightDataset: InsightDataset[] = [{
				id: id,
				kind: InsightDatasetKind.Sections,
				numRows: 4
			},
			{
				id: id2,
				kind: InsightDatasetKind.Rooms,
				numRows: 8
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Sections)
				.then(() => insightFacade.addDataset(id2, content2, InsightDatasetKind.Rooms))
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("is missing columns on some rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("missingColumnsOnTwoRooms.zip");
			let expectedIds: string[] = [id];
			let expectedInsightDataset: InsightDataset[] = [{
				id: id,
				kind: InsightDatasetKind.Rooms,
				numRows: 6
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Rooms)
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("still return room with empty string", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("emptyStringColumn.zip");
			let expectedIds: string[] = [id];
			let expectedInsightDataset: InsightDataset[] = [{
				id: id,
				kind: InsightDatasetKind.Rooms,
				numRows: 6
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Rooms)
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("is has empty index rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("emptyIndexFile.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has missing index only folders rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("missingIndexFileOnlyCampus.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has missing index only folders rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("missingIndexFileOnlyCampus.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has missing index other files rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("missingIndexFileOtherFiles.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has a bad building html", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("badBuildingHtml.zip");
			let expectedIds: string[] = [id];
			let expectedInsightDataset: InsightDataset[] = [{
				id: id,
				kind: InsightDatasetKind.Rooms,
				numRows: 8
			}];

			return insightFacade.addDataset(id, content, InsightDatasetKind.Rooms)
				.then((ret) => expect(ret).to.deep.equal(expectedIds))
				.then(() => insightFacade.listDatasets())
				.then((datasets) => expect(datasets).to.deep.equal(expectedInsightDataset));
		});

		it("has bad index html", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("randomIndex.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has no rooms", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("noRooms.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});

		it("has no buildings", () => {
			let id: string = "rooms";
			let content: string = getContentFromArchives("noBuildingsInIndex.zip");

			return expect(insightFacade.addDataset(id, content, InsightDatasetKind.Rooms))
				.to.eventually.be.rejectedWith(InsightError);
		});
	});
	// endregion
});

// region Query Dataset
describe("Elton Upgraded Query Dataset", function() {
	let insightFacade: InsightFacade;

	// region setup
	before(function () {
		console.info(`Before: ${this.test?.parent?.title}`);
		clearDisk();
		insightFacade = new InsightFacade();
		return insightFacade.addDataset("sections", getContentFromArchives("pair.zip"),
			InsightDatasetKind.Sections)
			.then(() => {
				if (!isC1Test) {
					return insightFacade.addDataset("rooms", getContentFromArchives("rooms.zip"),
						InsightDatasetKind.Rooms);
				}

				return;
			});
	});

	after(function () {
		console.info(`After: ${this.test?.parent?.title}`);
	});

	beforeEach(function () {
		// This section resets the insightFacade instance
		// This runs before each test
		console.info(`\nBeforeTest: ${this.currentTest?.title}`);
	});

	afterEach(function () {
		// This section resets the data directory (removing any cached data)
		// This runs after each test, which should make each test independent of the previous one
		console.info(`AfterTest: ${this.currentTest?.title}`);
	});

	// endregion

	// Assert value equals expected
	function assertResult(actual: any, expected: InsightResult[]): void {
		expect(actual).to.have.deep.members(expected);
	}

	type PQErrorKind = "ResultTooLargeError" | "InsightError";

	folderTest<unknown, Promise<InsightResult[]>, PQErrorKind>(
		"Elton Upgraded Perform Query Tests",
		(input) => insightFacade.performQuery(input),
		"./test/resources/elton-upgraded-folder-test",
		{
			assertOnResult: assertResult,
			errorValidator: (error): error is PQErrorKind =>
				error === "ResultTooLargeError" || error === "InsightError",
			assertOnError: (actual, expected) => {
				console.info(`Threw ${actual}`);
				if (expected === "ResultTooLargeError") {
					expect(actual).to.be.instanceof(ResultTooLargeError);
				} else {
					expect(actual).to.be.instanceof(InsightError);
				}
			},
		});
});

describe("Elton Order Query Dataset", function() {
	let insightFacade: InsightFacade;

	// region setup
	before(function () {
		console.info(`Before: ${this.test?.parent?.title}`);
		clearDisk();
		insightFacade = new InsightFacade();
		return insightFacade.addDataset("sections", getContentFromArchives("pair.zip"),
			InsightDatasetKind.Sections)
			.then(() => insightFacade.addDataset("rooms", getContentFromArchives("rooms.zip"),
				InsightDatasetKind.Rooms));
	});

	after(function () {
		console.info(`After: ${this.test?.parent?.title}`);
	});

	beforeEach(function () {
		// This section resets the insightFacade instance
		// This runs before each test
		console.info(`\nBeforeTest: ${this.currentTest?.title}`);
	});

	afterEach(function () {
		// This section resets the data directory (removing any cached data)
		// This runs after each test, which should make each test independent of the previous one
		console.info(`AfterTest: ${this.currentTest?.title}`);
	});

	// endregion

	// Assert value equals expected
	function assertResult(actual: any, expected: InsightResult[]): void {
		expect(actual).to.deep.equal(expected);
	}

	type PQErrorKind = "ResultTooLargeError" | "InsightError";

	folderTest<unknown, Promise<InsightResult[]>, PQErrorKind>(
		"Elton Upgraded Perform Query ORDER Tests",
		(input) => insightFacade.performQuery(input),
		"./test/resources/elton-upgraded-folder-test/C2 Tests/EBNF/ORDER",
		{
			assertOnResult: assertResult,
			errorValidator: (error): error is PQErrorKind =>
				error === "ResultTooLargeError" || error === "InsightError",
			assertOnError: (actual, expected) => {
				console.info(`Threw ${actual}`);
				if (expected === "ResultTooLargeError") {
					expect(actual).to.be.instanceof(ResultTooLargeError);
				} else {
					expect(actual).to.be.instanceof(InsightError);
				}
			},
		});
});
// endregion

// endregion
