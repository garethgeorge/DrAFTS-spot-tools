const debug = require("debug")("test.experiment");

const {ArgumentParser} = require("argparse");
const {Spinner} = require("cli-spinner");
const cliprogress = require("cli-progress");
const util = require("util");
const getRandomInt = util.promisify(require("secure_random").getRandomInt);
const assert = require("assert");

const {db, format} = require("../src/lib/db");
const {EC2} = require("../src/lib/aws");
const Fetcher = require("../src/helpers/fetch/Fetcher");

const config = require("../src/lib/config");
const {getPGraphForTimes} = require("../src/helpers/predict/predict");

const fs = require("async-file");

const { expect } = require("chai");

describe("experiment", function () {

  this.timeout(240 * 1000);
  describe("experimental incremental-update feature", () => {
    it("should get the same results whether or not the experimental incremental-update feature is enabled", async () => {
      // TODO: finish fleshing out the args struct
      const args = {
        binpath: config.BinPath,
        workdir: config.Workdir,
        region: config.Test.Experiment.Region,
        az: config.Test.Experiment.AZ,
        insttype: config.Test.Experiment.InstanceType,
        backlogDays: config.Test.Experiment.BacklogDays,
        conf: config.Test.Experiment.Conf,
        quant: config.Test.Experiment.Quant,
        duration: config.Test.Experiment.Duration,
        samples: config.Test.Experiment.Samples,
      }
  
      const expectedArgs = ["workdir", "region", "az", "insttype", "backlogDays",
      "conf", "quant", "duration", "samples"];
      expectedArgs.forEach(element => {
          expect(args).to.have.property(element);
        });
  
      const ec2 = new EC2(args.region, config.AWS.AccessKeyId, config.AWS.SecretAccessKey);
      const fetcher = new Fetcher(db, ec2, args.az);
      const msOneHour = 3600 * 1000;
      const msOneDay = (24 * msOneHour);
  
      debug("fetching the oldest and newest history records to compute the time " + 
        "interval we have to operate on");
      const newestHistoryRecord = await fetcher.getNewestHistoryRecord();
      const oldestHistoryRecord = await fetcher.getOldestHistoryRecord();
      debug("oldest history record is ", oldestHistoryRecord.Timestamp);
      debug("newest history record is ", newestHistoryRecord.Timestamp);
      const daysBetweenOldestAndNewestRecord = 
        ((newestHistoryRecord.Timestamp.getTime() 
        - oldestHistoryRecord.Timestamp.getTime()) / msOneDay);
      const daysExcludingBacklog = daysBetweenOldestAndNewestRecord - args.backlogDays;
      debug("there are " + daysBetweenOldestAndNewestRecord.toPrecision(2) + " days in the interval between them.");
      debug("backlog days is set to " + args.backlogDays + " so the interval " + 
        "on which we can operate is " + daysExcludingBacklog.toPrecision(2) + " days");
      assert(daysExcludingBacklog > 0, "expected days excluding backlog to be greater than zero, it was not.");
      
      const intervalStart = oldestHistoryRecord.Timestamp; // start fetching data, includes backlog
      const intervalEnd = newestHistoryRecord.Timestamp; // end fetching data
      const getTimeHoursAgo = (hours) => { // compute times going back from intervalEnd
        const time = new Date;
        time.setTime(
          intervalEnd.getTime() - hours * 3600 * 1000
        );
        return time;
      }
      intervalEnd.setTime(intervalEnd.getTime());
      const hoursInSampleRange = daysExcludingBacklog * 24;
      
      // generate the sequence of times to sample at
      debug("generating times");
      const times = []
      for (let i = 0; i < args.samples; ++i) {
        const minutesAgo = 
          (await getRandomInt(args.duration * 60, hoursInSampleRange * 60));
        debug("minutes ago: %o", minutesAgo);
        times.push(getTimeHoursAgo(minutesAgo / 60));
      }
      times.sort((date1, date2) => {
        if (date1 > date2) return 1;
        if (date1 < date2) return -1;
        return 0;
      }); // from https://gist.github.com/onpubcom/1772996
      debug("generated " + times.length + " time's at which we will be sampling.");
      
      debug("computing and pre-caching the pgraph objects for the time range " + 
        "of the experiment.");
      const progressBar = new cliprogress.Bar({}, cliprogress.Presets.shades_classic);
      progressBar.start(times.length, 0);
      let completedCount = 0;
      
      // get the pgraph array without with experimental features enabled
      const pgraphArray1 = await getPGraphForTimes(db, {
        workdir: config.Workdir,
        region: args.region,
        az: args.az,
        insttype: args.insttype,
        daterange: {
          start: oldestHistoryRecord.Timestamp, 
          end: intervalEnd
        },
        binpath: args.binpath,
        bmbp_ts_args: {
          quant: args.quant,
          conf: args.conf,
        },
        onResult: (result) => {
          completedCount++;
          progressBar.update(completedCount);
        }
      }, times);
      progressBar.stop();
  
      expect(pgraphArray1).to.have.length(args.samples);
      
      progressBar.start(times.length, 0);
      completedCount = 0;
      const pgraphArray2 = await getPGraphForTimes(db, {
        workdir: config.Workdir,
        region: args.region,
        az: args.az,
        insttype: args.insttype,
        daterange: {
          start: oldestHistoryRecord.Timestamp, 
          end: intervalEnd
        },
        binpath: args.binpath,
        bmbp_ts_args: {
          quant: args.quant,
          conf: args.conf,
        },
        onResult: (result) => {
          completedCount++;
          progressBar.update(completedCount);
        },
        noExperimental: true
      }, times);
      progressBar.stop();
  
      expect(pgraphArray2).to.have.length(args.samples);
  
      for (let i = 0; i < args.samples; ++i) {
        debug("checking pgraphArray1[%o] === pgraphArray2[%o]", i, i);
        const pgraph1 = pgraphArray1[i];
        const pgraph2 = pgraphArray2[i];
        expect(pgraph1.pgraph).to.deep.equal(pgraph2.pgraph);
      }
    });
  });
});