import Server from "../../src/rest/Server";
import chai, {assert, expect, use} from "chai";
import chaiHttp from "chai-http";
import {clearDisk, getContentFromArchives, getRawContentFromArchives} from "../TestUtil";
import {
	InsightDataset,
	InsightDatasetKind,
} from "../../src/controller/IInsightFacade";
import * as fs from "fs";
import {folderTest} from "@ubccpsc310/folder-test";
chai.use(chaiHttp);

const SERVER_URL = "http://localhost:4321";

describe("Server", function () {

	let server: Server;

	const archiveDirectory = "./test/resources/archives";
	const datasetContents = new Map<string, Buffer>();

	// Reference any datasets you've added to test/resources/archives here and they will
	// automatically be loaded in the 'before' hook.
	const datasetsToLoad: {[key: string]: string} = {
		sections: `${archiveDirectory}/pair.zip`,
		ubc: `${archiveDirectory}/ubc.zip`,
		someValidCourses: `${archiveDirectory}/someValidCourses.zip`, // 4 rows
		someValidCoursesAndRooms: `${archiveDirectory}/someValidCoursesAndRooms.zip`, // 4 section rows, 364 rooms
		someRoomsWithMissingBuildings: `${archiveDirectory}/someRoomsWithMissingBuildings.zip`
	};

	use(chaiHttp);

	before(function () {
		server = new Server(4321);

		for (const key of Object.keys(datasetsToLoad)) {
			const content = fs.readFileSync(datasetsToLoad[key]);
			datasetContents.set(key, content);
		}

		return server.start().catch((err) => {
			assert.fail(err);
		});
	});

	after(function () {
		return server.stop();
	});

	beforeEach(function () {
		console.log(`Before Test: ${this.currentTest?.title}`);
		clearDisk();
	});

	afterEach(function () {
		console.log(`After Test: ${this.currentTest?.title}`);
	});

	// Sample on how to format PUT requests
	it("PUT test for courses dataset", function () {
		let expectedIds: string[] = ["sections"];
		let expectedDatasets: InsightDataset[] = [{
			id: "sections",
			kind: InsightDatasetKind.Sections,
			numRows: 4
		}];
		try {
			return chai.request(SERVER_URL)
				.put(`/dataset/sections/${InsightDatasetKind.Sections}`)
				.send(datasetContents.get("someValidCourses"))
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: ChaiHttp.Response) {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members(expectedIds);
					return chai.request(SERVER_URL)
						.get("/datasets");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members(expectedDatasets);
				});
		} catch (err) {
			console.log(`Got error: ${err}`);
		}
	});

	it("should PUT courses and rooms dataset", function () {
		let expectedIds: string[] = ["sections", "rooms"];
		let expectedDatasets: InsightDataset[] = [
			{
				id: "sections",
				kind: InsightDatasetKind.Sections,
				numRows: 4
			},
			{
				id: "rooms",
				kind: InsightDatasetKind.Rooms,
				numRows: 364
			}];

		try {
			return chai.request(SERVER_URL)
				.put(`/dataset/sections/${InsightDatasetKind.Sections}`)
				.send(datasetContents.get("someValidCoursesAndRooms"))
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: ChaiHttp.Response) {
					expect(res.status).to.be.equal(200);
					return chai.request(SERVER_URL)
						.put(`/dataset/rooms/${InsightDatasetKind.Rooms}`)
						.send(datasetContents.get("someValidCoursesAndRooms"))
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members(expectedIds);
					return chai.request(SERVER_URL)
						.get("/datasets");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members(expectedDatasets);
				});
		} catch (err) {
			console.log(`Got error: ${err}`);
		}
	});

	it("should DELETE courses dataset", function () {
		let expectedIds: string[] = ["sections"];
		let expectedDatasets: InsightDataset[] = [
			{
				id: "sections",
				kind: InsightDatasetKind.Sections,
				numRows: 4
			},
			{
				id: "rooms",
				kind: InsightDatasetKind.Rooms,
				numRows: 364
			}];
		try {
			return chai.request(SERVER_URL)
				.put(`/dataset/sections/${InsightDatasetKind.Sections}`)
				.send(datasetContents.get("someValidCoursesAndRooms"))
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: ChaiHttp.Response) {
					expect(res.status).to.be.equal(200);
					return chai.request(SERVER_URL)
						.put(`/dataset/rooms/${InsightDatasetKind.Rooms}`)
						.send(datasetContents.get("someValidCoursesAndRooms"))
						.set("Content-Type", "application/x-zip-compressed");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					return chai.request(SERVER_URL)
						.get("/datasets");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members(expectedDatasets);
					return chai.request(SERVER_URL)
						.delete("/dataset/sections");
				})
				.then((res) => {
					expect(res.status).to.equal(200);
					expect(res.body.result).to.equal("sections");
					return chai.request(SERVER_URL)
						.get("/datasets");
				})
				.then((res) => {
					expect(res.status).to.be.equal(200);
					expect(res.body.result).to.deep.members([{
						id: "rooms",
						kind: InsightDatasetKind.Rooms,
						numRows: 364
					}]);
				});
		} catch (err) {
			console.log(`Got error: ${err}`);
		}
	});

	it("should return 404 delete dataset", function () {
		try {
			return chai.request(SERVER_URL)
				.delete("/dataset/sections")
				.then(function (res: ChaiHttp.Response) {
					expect(res.status).to.be.equal(404);
					return chai.request(SERVER_URL)
						.delete("/dataset/s____   __");
				}).then((res) => {
					expect(res.status).to.equal(400);
				});
		} catch (err) {
			console.log(`Got error: ${err}`);
		}
	});

});

describe("folder-tests", function() {

	let server: Server;

	// region setup
	before(function () {
		server = new Server(4321);

		return server.start().catch((err) => {
			assert.fail(err);
		}).then(() => {
			console.info(`Before: ${this.test?.parent?.title}`);
			clearDisk();
			return chai.request(SERVER_URL)
				.put(`/dataset/sections/${InsightDatasetKind.Sections}`)
				.send(getRawContentFromArchives("pair.zip"))
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: ChaiHttp.Response) {
					return chai.request(SERVER_URL)
						.put(`/dataset/rooms/${InsightDatasetKind.Rooms}`)
						.send(getRawContentFromArchives("rooms.zip"))
						.set("Content-Type", "application/x-zip-compressed");
				});
		});
	});

	after(function () {
		server.stop();
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
	function assertResult(actual: any, expected: any): void {
		expect(actual.status).to.equal(200);
		expect(actual.body.result).to.have.deep.members(expected);
	}

	folderTest<any, Promise<ChaiHttp.Response>, ChaiHttp.Response>(
		"Elton Upgraded Perform Query Tests",
		(input) => {
			return chai.request(SERVER_URL)
				.post("/query")
				.send(input)
				.set("Content-Type", "application/json")
				.then((res) => {
					return res.status === 200 ? res : Promise.reject(res);
				});
		},
		"./test/resources/elton-upgraded-folder-test",
		{
			assertOnResult: assertResult,
			assertOnError: (actual, expected) => {
				console.log(`Response body is ${actual.body}`);
				expect(actual.status).to.equal(400);
			},
		});
});
