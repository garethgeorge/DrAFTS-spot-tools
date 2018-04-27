const util = require("util");
const fs = require("fs");
const argparse = require('argparse');
const debug = require("debug")("script");
const cliprogress = require("cli-progress");
const Spinner = require('cli-spinner').Spinner;
const zlib = require('zlib');
const path = require("path");

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
  ["filename"],
  {
    help: "the name of the file that we will write the database out to"
  }
)

const args = parser.parseArgs();

const QUERY_FETCH_TOTAL = `
  SELECT COUNT(*) 
  FROM history 
  WHERE region = %L
`

const QUERY_FETCH_HISTORY = `
  SELECT * 
  FROM history 
  WHERE region = %L
`;


(async () => {
  
  console.log(`dumping the entire database to ${args.filename}`);
  
  let outfile = fs.createWriteStream(args.filename);
  if (path.extname(args.filename) === '.gz') {
    console.log("\tdetermined that file is a .gz file based on its extension, " + 
      "creating a gzip reader");
      const gz = zlib.createGzip();
      gz.pipe(outfile);
      outfile = gz
  }


  const total = await db.query(format(QUERY_FETCH_TOTAL, args.region));
  console.log(total.rows);

  const progress = new cliprogress.Bar({}, cliprogress.Presets.shades_classic);
  progress.start(total.rows[0].count, 0);
  let lineCount = 0;
  let byteCount = 0;

  const writeRow = (row) => {
    outfile.write(`${row.region.trim()}\t${row.az.trim()}\t${row.insttype.trim()}\t${row.ts.trim}\t${row.spotprice}\n`);
    lineCount++;
    byteCount += row.length;
    // spinner.setSpinnerTitle(`exported ${lineCount} records, ${byteCount} lines written`);
    progress.update(lineCount);
  }
  
  for await (const row of db.queryCursor(format(QUERY_FETCH_HISTORY, args.region))) {
    writeRow(row);
  }

  console.log("done.");

  outfile.end();

  db.end();

  progress.stop(true);

})();
