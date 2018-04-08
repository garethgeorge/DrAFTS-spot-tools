const {expect} = require("chai");
const _ = require("lodash");

const config = require("../src/lib/config");
const {db, format} = require("../src/lib/db");
const {parseTimeRange} = require("../src/helpers/common/timeutils")
const {getPGraph, getPGraphForTimes} = require("../src/helpers/predict/predict");

const splitDateRange = (daterange, parts) => {
  let times = []
  const st = daterange.start.getTime();
  const et = daterange.end.getTime();
  for (let i = 1; i <= parts; ++i) {
    const date = new Date();
    date.setTime(st + (et - st) * (1 / parts) * i);
    times.push(date);
  }
  return times;
}

describe("Predict", function () {
  this.timeout(30000);
  const testConfig = config.Test.Predict;
  const dateRange = parseTimeRange(testConfig.DateRange);
  const getPGraphOpts = {
    workdir: config.Workdir,
    region: testConfig.Region,
    az: testConfig.AZ,
    insttype: testConfig.InstanceType,
    daterange: dateRange,
    binpath: testConfig.BinPath,
    bmbp_ts_args: {
      quant: testConfig.Quant,
      conf: testConfig.Conf,
    },
  }
  
  describe("database", () => {
    it("should find some data in the database (if this fails, you need to run a fetch)", async () => {
      await db.query(format(`
        SELECT * 
        FROM history
        WHERE ts >= %L AND ts < %L`,
        getPGraphOpts.daterange.start,
        getPGraphOpts.daterange.end,
      ))
    });
  });

  describe("fetching a single time interval", () => {
    it("should yield results", async () => {
      const result = await getPGraphForTimes(db, getPGraphOpts, [getPGraphOpts.daterange.end]);
    });

    it("should be the same using getPGraph and getPGraphForTimes", async () => {
      const original = await getPGraph(db, getPGraphOpts);
      const result = await getPGraphForTimes(db, getPGraphOpts, [getPGraphOpts.daterange.end]);
      expect(original).to.exist;
      expect(result[0]).to.exist;
      expect(result[0]).to.have.property("pgraph");
      expect(result[0].pgraph).to.deep.equal(original)
    });
  });

  describe("fetching segmented time intervals (multiple pgraph sample points specified)", () => {
    let expectedPGraph = null;
    before(async () => {
      expectedPGraph = (await getPGraphForTimes(db, getPGraphOpts))[0].pgraph;
      expect(expectedPGraph).to.exist;
    });

    it("should get the correct expected results for each sub-interval", async () => {
      const result = await getPGraphForTimes(db, getPGraphOpts, splitDateRange(dateRange, 2));
      const lastResult = result[result.length-1];
      const pgraph = lastResult.pgraph;
      expect(pgraph).to.deep.equal(expectedPGraph);;
    });

    it("should fail when the intervals do not match", async () => {
      const result = await getPGraphForTimes(db, getPGraphOpts, splitDateRange(dateRange, 2));
      const lastResult = result[0];
      const pgraph = lastResult.pgraph;
      expect(pgraph).to.not.deep.equal(expectedPGraph);;
    });

    it("expensive test: it should get the correct results over 4-sub-intervals, checking incrementally", async () => {
      const times = splitDateRange(dateRange, 3);
      const results = await getPGraphForTimes(db, getPGraphOpts, times);
      expect(results).to.have.length(times.length);

      for (const result of results) {
        const myDateRange = {
          start: dateRange.start,
          end: result.interval.end
        }

        const opts = _.cloneDeep(getPGraphOpts);
        opts.daterange = myDateRange;
        const expectedResult = (await getPGraphForTimes(db, opts))[0].pgraph;
        expect(result.pgraph).to.deep.equal(expectedResult);
      }
    });
  });
  
  after(() => {
    db.end();
  });
})