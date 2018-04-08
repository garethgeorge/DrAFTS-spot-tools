const ArgumentParser = require("argparse").ArgumentParser;
const prompt = require("prompt-async");
const fs = require("async-file");
const path = require("path");
const assert = require("assert");
const Spinner = require('cli-spinner').Spinner;

const config = require("../src/lib/config");
const {db, format} = require("../src/lib/db");
const timeutils = require("../src/helpers/common/timeutils");
const {getPGraphForTimes} = require("../src/helpers/predict/predict");


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
  ["daterange"],
  {
    help: "the range from which to pull the data which will be used to initialize the prediction engine",
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

const args = parser.parseArgs();

(async () => {
  
  assert(!!config.Workdir,
    "required property config.Workdir should specify the location of a " +
    "temporary work directory.");

  const {start, end} = timeutils.parseTimeRange(args.daterange);

  const spinner = new Spinner("generating pgraph file");
  spinner.start();
  
  const result = await getPGraphForTimes(db, {
    workdir: config.Workdir,
    region: args.region,
    az: args.az,
    insttype: args.insttype,
    daterange: {start, end},
    binpath: args.binpath,
    bmbp_ts_args: {
      quant: args.quant,
      conf: args.conf,
    },
  }, [end]);
  spinner.stop(true);
  
  await fs.writeFile(args.outputFile, JSON.stringify(result, null, 2));
  
  db.end();  
})()
