const fs = require("fs");
const argparse = require('argparse');
const debug = require("debug")("script");
const cliprogress = require("cli-progress");
const Spinner = require('cli-spinner').Spinner;
const zlib = require('zlib');
const path = require("path");
const Semaphore = require("await-semaphore");
const {asyncIterateStream} = require("async-iterate-stream/asyncIterateStream");
const asyncParallel = require("../src/lib/async-parallel");

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
    help: "the name of the dataset file that we will be reading in (importing)"
  }
)

const args = parser.parseArgs();

const QUERY_INSERT_HISTORY = `
  INSERT INTO history (region, az, insttype, ts, spotprice)
  VALUES %L 
  ON CONFLICT (region, az, insttype, ts) DO UPDATE
  SET spotprice = excluded.spotprice;
`;

function chunk (arr, len) {
  var chunks = [],
      i = 0,
      n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }
  return chunks;
}

class BatchInserter {
  constructor(db, query, bufferSize) {
    this.db = db;
    this.query = query;
    this.queue = [];
    this.bufferSize = bufferSize;
    this.totalInserted = 0;
    this.failedCount = 0;
  }

  async addRow(data) {
    this.queue.push(data);
    if (this.queue.length >= this.bufferSize) {
      await this.batchInsert();
    }
  }
  
  async batchInsert() {
    if (this.queue.length > 0) {
      console.log(
        `${args.filename}: inserting ${this.queue.length} objects into db, ${this.totalInserted} ` + 
        `objects inserted so far`);
      try {
        // const chunks = chunk(this.queue, this.bufferSize / 8);
        await this.db.query(format(this.query, this.queue));
        this.totalInserted += this.queue.length;
      } finally {
        this.queue = []
      }
    }
  }

}


async function *streamLineByLine(stream) {
  console.log("trying to iterate stream line by line!");
  let text = '';
  for await (let line of stream) {
    text += line;
    while (true) {
      const newLine = text.indexOf('\n');
      if (newLine !== -1) {
        yield text.substring(0, newLine);
      } else
         break 
      text = text.substring(newLine + 1);
    }
  }
}

(async () => {

  const batchInserter = new BatchInserter(db, QUERY_INSERT_HISTORY, 16 * 1024);
  
  console.log("opening file: " + args.filename);
  // TODO: add code that allows for reading a gzip read stream
  let inputstream = fs.createReadStream(args.filename);
  if (path.extname(args.filename) === '.gz') {
    console.log("\tdetermined that file is a .gz file based on its extension, " + 
      "creating a gzip reader");
    inputstream = inputstream.pipe(zlib.createGunzip());
  }
  
  console.log("created read stream, reading files");
  const lineReader = streamLineByLine(asyncIterateStream(inputstream));
  let lineCount = 0;
  for await (let line of lineReader) {
    const parts = line.split("\t");
    if (parts.length <= 1)
      return null; // its probably a blank line at the end of the file 
    const az = parts[1];
    const instType = parts[2];
    const price = parseFloat(parts[4]);
    const date = new Date(parts[5]);
    
    if (!az || !instType || !price || !date || date == null) 
      continue;

    lineCount++;
    await batchInserter.addRow([args.region, az, instType, date, price]);
  }
  console.log(`inserted ${lineCount} records`);
  console.log("done.");
  await batchInserter.batchInsert();
  
  await db.end();
  
})();

