const {ArgumentParser} = require("argparse");
const {Spinner} = require("cli-spinner");
const cliprogress = require("cli-progress");
const util = require("util");
const getRandomInt = util.promisify(require("secure_random").getRandomInt);
const assert = require("assert");
const process = require("process");

const {db, format} = require("../src/lib/db");
const {EC2} = require("../src/lib/aws");
const Fetcher = require("../src/helpers/fetch/Fetcher");

const config = require("../src/lib/config");
const {getPGraphForTimes} = require("../src/helpers/predict/predict");
const debug = require("debug")("script");

const fs = require("async-file");

const parser = new ArgumentParser({
  version: "1.0.0",
  addHelp: true,
  description: "used to fetch or update the dataset from AWS's servers!"
});

parser.addArgument(
  ["region"],
  {}
)

parser.addArgument(
  ["az"],
  {}
)

parser.addArgument(
  ["insttype"]
)

parser.addArgument(
  ["--backlogDays"],
  {
    defaultValue: 30,
    type: "int"
  }
)

parser.addArgument(
  ["--samples"],
  {
    required: true,
    type: "int",
    defaultValue: 100,
    help: "the number of 'experiments' to run"
  }
)

parser.addArgument(
  ["--duration"],
  {
    required: true,
    type: "int"
  }
)

parser.addArgument(
  ["--binpath"],
  {
    help: "the path to the bmbp_ts and pred-distribution binaries",
    required: true,
  }
);

parser.addArgument(
  "--quant",
  {
    defaultValue: 0.975,
    type: "float",
    help: "the quantile parameter to bmbp_ts"
  }
)

parser.addArgument(
  "--conf",
  {
    defaultValue: 0.01,
    type: "float",
    help: "the confidence parameter to bmbp_ts"
  }
)

parser.addArgument(
  ["--outputFile"],
  {
    help: "the path to the JSON file where we should dump our output data, " + 
    "if an interval file was provided then this will contain the recommended " +
    "bid price for each interval. Otherwise it will contain a pgraph file " + 
    "mapping bid prices to durations.",
    defaultValue: "output.json",
  }
)

const args = parser.parseArgs();

process.on("unhandledRejection", (p, reason) => {
  console.log("last resourt handling of uncaught rejection!");
  const fs = require("fs"); // the real fs library.
  fs.writeFileSync(args.outputFile, JSON.stringify({
    error: `Unhandled rejection: ${p}`
  }, null, 2));
  process.exit(-1);
});

process.on("uncaughtException", (err) => {
  console.log("last resourt handling of uncaught exception!");
  const fs = require("fs"); // the real fs library.
  fs.writeFileSync(args.outputFile, JSON.stringify({
    error: `Fatal exception ${err}`
  }, null, 2));
  process.exit(-1);
});

const calculateBidPrice = (pgraph, duration) => {
  assert(pgraph, "pgraph must not be null or undefined");
  assert(pgraph.length > 0, "pgraph is expected to have at least 1 entry.");
  for (const row of pgraph) {
    if (row.duration >= duration) {
      return row.price;
    }
  }
  return pgraph[pgraph.length - 1].price;
}

(async () => {
  const ec2 = new EC2(args.region, config.AWS.AccessKeyId, config.AWS.SecretAccessKey);
  const fetcher = new Fetcher(db, ec2, args.az);
  const msOneHour = 3600 * 1000;
  const msOneDay = (24 * msOneHour);

  try {
    debug("fetching the oldest and newest history records to compute the time " + 
      "interval we have to operate on");
    const newestHistoryRecord = await fetcher.getNewestHistoryRecord();
    const oldestHistoryRecord = await fetcher.getOldestHistoryRecord();
    console.log("oldest history record is ", oldestHistoryRecord.Timestamp);
    console.log("newest history record is ", newestHistoryRecord.Timestamp);
    const daysBetweenOldestAndNewestRecord = 
      ((newestHistoryRecord.Timestamp.getTime() 
      - oldestHistoryRecord.Timestamp.getTime()) / msOneDay);
    const daysExcludingBacklog = daysBetweenOldestAndNewestRecord - args.backlogDays;
    console.log("there are " + daysBetweenOldestAndNewestRecord.toPrecision(2) + " days in the interval between them.");
    console.log("backlog days is set to " + args.backlogDays + " so the interval " + 
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
    const times = []
    for (let i = 0; i < args.samples; ++i) {
      const minutesAgo = 
        (await getRandomInt(args.duration * 60, hoursInSampleRange * 60));
      times.push(getTimeHoursAgo(minutesAgo / 60));
    }
    times.sort((date1, date2) => {
      if (date1 > date2) return 1;
      if (date1 < date2) return -1;
      return 0;
    }); // from https://gist.github.com/onpubcom/1772996
    console.log("generated " + times.length + " time's at which we will be sampling.");
    
    console.log("computing and pre-caching the pgraph objects for the time range " + 
      "of the experiment.");
    const progressBar = new cliprogress.Bar({}, cliprogress.Presets.shades_classic);
    progressBar.start(times.length, 0);
    let completedCount = 0;
    
    const pgraphArray = await getPGraphForTimes(db, {
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


    assert(pgraphArray.length === times.length, "expected pgraphArray.length (" + pgraphArray.length + ") to equal times.length (" + times.length + ")");
    
    console.log("running the simulation, and computing pre-mature terminations");
    const results = {}
    results.terminations = 0;
    results.samples = [];
    results.args = args;
    const log = [];
    for (let i = 0; i < times.length; ++i) {
      const time = times[i];
      const timeEnd = new Date;
      timeEnd.setTime(time.getTime() + args.duration * msOneHour);

      // first we get all spot prices that might be inside the time range,
      const historyObjects = await fetcher.fetchTimeRangeFromDB(time, timeEnd, args.insttype);
      // then we add in the spot price just before the time range started to
      // make sure we have every price that covers the time interval
      historyObjects.push(await fetcher.getSpotPriceForTime(time, args.insttype));
      const spotPrices = historyObjects.map(x => x.SpotPrice);
      spotPrices.sort();

      // get the pgraph and compute a bid price
      const correspondingPGraph = pgraphArray[i].pgraph;
      const bidprice = calculateBidPrice(correspondingPGraph, args.duration);
      
      debug("sample #%o", i);
      debug("\tspot prices at time %o were %o", time, spotPrices);
      debug("\trecommended bid price is %o", bidprice);

      const terminated = spotPrices[spotPrices.length - 1] > bidprice;
      if (terminated) {
        debug("\tterminated due to spot price %o exceeding bid price of %o", 
          spotPrices[spotPrices.length - 1], bidprice);
      }
      debug("\tterminated: %o", terminated);

      if (terminated)
        results.terminations++;
      
      results.samples.push({
        time: times[i],
        duration: args.duration,
        bidprice: bidprice,
        prices: spotPrices,
        terminated: terminated
      });
    }

    console.log("writing results to '" + args.outputFile + "'");
    await fs.writeFile(
      args.outputFile, 
      JSON.stringify({
        results: results
      }, null, 2)
    );
    
    console.log("terminations: " + results.terminations);
  } finally {
    db.end();
  }
  
})()