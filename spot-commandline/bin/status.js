const argparse = require('argparse');
const debug = require("debug")("script");
const dateformat = require("dateformat");
const Table = require("cli-table");
const _ = require("lodash");
const process = require("process");
const path = require("path");

const config = require("../src/lib/config");
const {db, format} = require("../src/lib/db");

const ArgumentParser = require("argparse").ArgumentParser;
const parser = new ArgumentParser({
  version: "1.0.0",
  addHelp: true,
  description: "used to fetch or update the dataset from AWS's servers!"
});

parser.addArgument(
  ["region"], 
  {
    help: "the region to print the status information for"
  }
);

parser.addArgument(
  ["--az"],
  {
    help: "the az to limit the query to"
  }
)

parser.addArgument(
  ["--machineStatus"],
  {
    help: "we can use machineStatus to request that the full status regarding region, az, inst_type, record count be printed for every day",
    required: false,
    action: "storeTrue",
  }
)

const args = parser.parseArgs();

(async () => {
  // when used as a part of a shell script we get simple, machine readable, output
  if (!process.stdout.isTTY || args.machineStatus) {
    if (args.machineStatus) {
      const results = await db.query(format(`
        SELECT region, az, insttype, date_trunc('day', ts) AS day, COUNT(*) AS count 
        FROM history 
        WHERE region = %L
        GROUP BY region, az, insttype, date_trunc('day', ts) 
        ORDER BY region, az, insttype, day;
      `, args.region));
      for (const row of results.rows) {
        console.log([row.region.trim(), row.az.trim(), row.insttype.trim(), row.day.toISOString(), row.count].join(','));
      }
    } else if (args.az) {
      const results = await db.query(format(`
        SELECT DISTINCT insttype, MIN(spotprice) AS min, MAX(spotprice) AS max, STDDEV(spotprice) AS stddev
        FROM history
        WHERE region = %L AND az = %L
        GROUP BY insttype
        ORDER BY insttype
      `, args.region, args.az));

      for (const row of results.rows) {
        console.log(row.insttype.trim() + "," + row.min + "," + row.max + "," + row.stddev);
      }
    } else {
      const results = await db.query(format(`
        SELECT DISTINCT az 
        FROM history
        WHERE region = %L
        ORDER BY az
      `, args.region));

      for (const row of results.rows) {
        console.log(row.az);
      }
    }

    db.end();

    return ;
  }

  {
    const results = await db.query(format(`
      SELECT region, az, date_trunc('day', ts) AS day, COUNT(*) AS count 
      FROM history 
      WHERE region = %L
      GROUP BY region, az, date_trunc('day', ts) 
      ORDER BY region, az, day;
    `, args.region));

    const table = new Table({
      head: ["az", "date", "record count"],
      colWidths: [20, 30, 20]
    })

    for (const row of results.rows) {
      if (args.az && row.az.trim() !== args.az)
        continue ;
      table.push([row.az.trim(), dateformat(row.day, "yyyy-mm-dd (yyyymmdd)"), row.count]);
    }
    console.log("data counts by day");
    console.log(table.toString());
  }
  

  {
    const results = await db.query(format(`
    SELECT DISTINCT az, insttype, MIN(spotprice) AS min, MAX(spotprice) AS max, STDDEV(spotprice) AS stddev, ABS(MAX(spotprice) - MIN(spotprice)) AS range
    FROM history
    WHERE region = %L
    GROUP BY insttype, az
    ORDER BY insttype, az
    `, args.region));

    const table = new Table({
      head: ["az", "instance type", "min", "max", "range", "stddev"],
      colWidths: [20, 20, 12, 12, 15, 15],
    })
    console.log("available instance types");
    for (const row of results.rows) {
      if (args.az && row.az.trim() !== args.az)
        continue ;
      table.push([row.az.trim(), row.insttype.trim(), row.min, row.max, Math.round(row.range * 10000) / 10000, Math.round(row.stddev * 10000) / 10000]);
    }
    console.log(table.toString());
  }
    
  db.end();
})()
