const argparse = require('argparse');
const debug = require("debug")("script");
const cliprogress = require("cli-progress");
const Spinner = require('cli-spinner').Spinner;

const config = require("../src/lib/config");
const {db, format} = require("../src/lib/db");
const {EC2} = require("../src/lib/aws");
const Fetcher = require("../src/helpers/fetch/Fetcher");
const timeutils = require("../src/helpers/common/timeutils");

const ArgumentParser = require("argparse").ArgumentParser;
const parser = new ArgumentParser({
  version: "1.0.0",
  addHelp: true,
  description: "used to fetch or update the dataset from AWS's servers!"
});

parser.addArgument(
  ["region"]
);

parser.addArgument(
  ["daterange"], 
  {
    help: "the daterange to fetch. Specify as YYYYMMDD-YYYYMMDD or 'update' to update.",
  }
)

// parser.addArgument(
//   ["-y"],
//   {
//     action: "storeTrue",
//   }
// )

const args = parser.parseArgs();

(async () => {
  console.log("printing out the database status");
  
  // create an instance of ec2
  const ec2 = new EC2(args.region, config.AWS.AccessKeyId, config.AWS.SecretAccessKey);
  console.log("getting list of availability zones:");
  const azlist = await ec2.getAvailabilityZones();
  for (const az of azlist) {
    console.log("\t - " + az);
  }
  
  if (args.daterange === "update") {
    console.log("updating the dataset to be in sync with current time");
    
    for (const az of azlist) {
      console.log("\tAZ: " + az);
      const fetcher = new Fetcher(db, ec2, az);
      const spinner = new Spinner("updating " + az);
      spinner.start();
      await fetcher.update((pageno) => {
        spinner.setSpinnerTitle("updating " + az + " (pageno: " + pageno + ")");
      });
      spinner.stop(true);
    }
  } else {
    const {start, end} = timeutils.parseTimeRange(args.daterange);

    console.log("Date range to fetch is ", start, " - ", end);

    for (const az of azlist) {
      console.log("\tAZ: " + az);
      const fetcher = new Fetcher(db, ec2, az);

      const progressBar = new cliprogress.Bar({}, cliprogress.Presets.shades_classic);
      progressBar.start(end.getTime() - start.getTime(), 0);

      await fetcher.fetchTimeRange(start, end, (pageno, data) => {
        const lastRecord = data[data.length - 1]
        progressBar.update(end.getTime() - lastRecord.Timestamp.getTime());
      });

      progressBar.update(end.getTime() - start.getTime());
      progressBar.stop();
    }
  }
  
  await db.end();
})()
