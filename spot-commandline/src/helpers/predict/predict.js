const assert = require("assert");
const child_process = require("child_process");
const process = require("process");
const fs = require("async-file");
const asyncMap = require("../../lib/async-map");
const path = require("path");
const promisifyEvent = require("promisify-event");
const {db, format} = require("../../lib/db");
const _ = require("lodash");
const debug = require("debug")("helpers.predict.predict");
const {withTempDir} = require("../common/fsutil");

const runExecutableHelper = (path, args) => {
  return new Promise((accept, reject) => {
    const child = child_process.spawn(path, args);
    // child.stdout.pipe(process.stdout);
    // child.stderr.pipe(process.stderr);
    child.on("exit", () => { 
      accept() 
    });
  });
}

const parsePGraph = (pgraph) => {
  const data = pgraph.split("\n").filter(x => x.trim().length > 0).map(line => {
    return line.trim().split(" ");
  }).map(x => {return {
    duration: parseFloat(x[0]),
    price: parseFloat(x[1])
  }});
  return data;
}

/**
 * THIS IS THE LEGACY VERSION OF THIS FUNCTION, IT IS NOT NECESSARILY
 * WORKING CORRECTLY
 * YOU SHUOLD BE USING getPGraphForTimes
 * AS IT IS TESTED AND ENCORPORATES ADDITIONAL FUNCTIONALITY
 */
async function getPGraph(db, {
    workdir, region, az, insttype, daterange, binpath,
    bmbp_ts_args
  }) {
  assert(region, "opts.region required.");
  assert(az, "opts.az required");
  assert(insttype, "opts.insttype required");
  assert(daterange, "opts.daterange required");
  assert(binpath, "opts.binpath required");
  assert(bmbp_ts_args, "opts.bmbp_ts_args required");
  const {start, end} = daterange;
  const {quant, conf} = bmbp_ts_args;
  assert(quant, "opts.bmbp_ts_args.quant required");
  assert(conf, "opts.bmbp_ts_args.conf required");


  return await withTempDir(workdir, async (workdir) => {
    // fetch the data from the database
    debug("getPGraph");

    debug("fetching time interval %o - %o", start, end);
    const writeStream = fs.createWriteStream(path.join(workdir, "data.txt"));
    const result = await db.query(format(`
      SELECT * 
      FROM history 
      WHERE region = %L AND az = %L AND insttype = %L AND ts > %L AND ts < %L
      ORDER BY ts 
    `, region, az, insttype, start, end));
    for (const row of result.rows) {
      const ts = Math.round(row["ts"].getTime() / 1000);
      writeStream.write(ts + " " + row["spotprice"].toPrecision(6) + "\n");
    }
    writeStream.end();
    
    {
      const cmdargs = [
        "./shellscripts/predict.sh", 
        workdir, "../bin", 
        quant, conf, 
        1 - quant, 1 - conf, 
        350 /* interval */];
        debug("running sh [" + cmdargs.join(",") + "]");
      await runExecutableHelper("sh", cmdargs);
    }

    // return the pgraph data structure
    return parsePGraph(
      (await fs.readFile(path.join(workdir, "graph.pgraph"))).toString()
    );
  }); 
}

async function getPGraphForTimes(db, args, times=null) {
  const {
    workdir, region, az, insttype, daterange, binpath,
    bmbp_ts_args, onResult, noExperimental
  } = args;
  debug("getPGraphForTimes");
  assert(region, "opts.region required.");
  assert(az, "opts.az required");
  assert(insttype, "opts.insttype required");
  assert(daterange, "opts.daterange required");
  assert(binpath, "opts.binpath required");
  assert(bmbp_ts_args, "opts.bmbp_ts_args required");
  const {start, end} = daterange;
  const {quant, conf} = bmbp_ts_args;
  assert(quant, "opts.bmbp_ts_args.quant required");
  assert(conf, "opts.bmbp_ts_args.conf required");

  if (!times) {
    times = [end]; // just get the pgraph for the last time specified!!! but in reality we can, indeed, do much better :)
  }

  if (noExperimental) {
    console.log("\tno experimental was passed to predict")
    debug("getPGraphForTimes noExperimental option was passed -- breaking up request using asyncMap");
    // bit of a janky hack but it disables use of the experimental
    // incremental update feature
    const argsCopy = _.cloneDeep(args);
    argsCopy.noExperimental = false;
    const results = (await asyncMap(times, async (time) => {
      return await getPGraphForTimes(db, argsCopy, times=[time]);
    })).map((result) => {
      return result[0];
    });
    return results;
  }
  

  return await withTempDir(workdir, async (workdir) => {
    debug("received temporary directory: %o", workdir);

    const results = []
    let lastTime = start;
    let finalResult = null;
    let cycleCount = 0;
    let skipped = [];
    for (const endInterval of times) {
      assert((results.length + skipped.length) === cycleCount++);

      const startInterval = lastTime;
      lastTime = endInterval;

      // endInterval - startInterval is the region of time that has not yet been
      // processed by bmbp_ts, it can be imagined as a sliding region
      // sliding through the 'times' array to be sampled!
      debug("fetching data for time interval %o - %o", startInterval, endInterval);
      const result = await db.query(format(`
        SELECT * 
        FROM history
        WHERE region = %L AND az = %L AND insttype = %L AND ts >= %L AND ts < %L
        ORDER BY ts ASC
      `, region, az, insttype, startInterval, endInterval));
      const history = result.rows;
      debug("got %o records", history.length);

      if (history.length === 0) {
        debug("short-cutting this cycle as there are no new records, pushing a copy of the previous result to the result array");
        if (finalResult) {
          finalResult = {
            interval: {
              start: startInterval,
              end: endInterval,
            },
            pgraph: finalResult.pgraph
          }

          results.push(finalResult);
          onResult(finalResult);
        } else {
          skipped.push({
            start: startInterval,
            end: endInterval,
          })
        }
        continue;
      }

      const dataWriteStream = fs.createWriteStream(
        path.join(workdir, "data.txt"), {
          flags: 'w',
        }
      );

      debug("writing those records to disk");
      for (const row of history) {
        const ts = Math.round(row["ts"].getTime() / 1000); // round each timestamp to the nearest second
        dataWriteStream.write(ts + " " + row["spotprice"].toPrecision(6) + "\n");
      }

      dataWriteStream.end();
      await promisifyEvent(dataWriteStream, "close");
      debug("flushed the data to disk, ready to process data with sip-processor");

      // Now that the data is flushed out to the disk, we are ready to process it
      const cmdargs = [
        "./shellscripts/predict.sh",
        workdir, binpath,
        quant, conf,
        1 - quant, 1 - conf,
        350 /* bmbp_ts interval param TODO: make this configurable */,];
      debug("running sh %o", cmdargs);
      await runExecutableHelper("sh", cmdargs);

      const pgraphData = parsePGraph(
        (await fs.readFile(path.join(workdir, "graph.pgraph"))).toString()
      );

      finalResult = {
        interval: {
          start: startInterval,
          end: endInterval,
        },
        pgraph: pgraphData
      }

      for (let i = 0; i < skipped.length; ++i) {
        results.push({
          interval: skipped[i], 
          pgraph: pgraphData,
        });
      }
      skipped = []

      results.push(finalResult);

      if (onResult)
        onResult(finalResult);
    }

    return results;
  });
}

async function getPGraphAdv(db, args, times=null) {
  const {
    workdir, region, az, insttype, daterange, binpath,
    bmbp_ts_args, onResult, noExperimental
  } = args;
  debug("getPGraphForTimes");
  assert(region, "opts.region required.");
  assert(az, "opts.az required");
  assert(insttype, "opts.insttype required");
  assert(daterange, "opts.daterange required");
  assert(binpath, "opts.binpath required");
  assert(bmbp_ts_args, "opts.bmbp_ts_args required");
  const {start, end} = daterange;
  const {quant, conf} = bmbp_ts_args;
  assert(quant, "opts.bmbp_ts_args.quant required");
  assert(conf, "opts.bmbp_ts_args.conf required");

  if (!times) {
    times = [end];
  }

  return await withTempDir(workdir, async (workdir) => {
    const pgraphs = [];
    let lastTime = start;

    for (const time of times) {
      const start = lastTime;
      const stop = time;
      lastTime = time;

      debug("fetching data for interval %o - %o", start, stop);
      const result = await db.query(format(`
        SELECT * 
        FROM history
        WHERE region = %L AND az = %L AND insttype = %L AND ts >= %L AND ts < %L
        ORDER BY ts ASC
      `, region, az, insttype, start, stop));
      const history = result.rows;
      debug("got %o records", history.length);

      if (history.length == 0) {
        debug("\tno new records, skipping this cycle");
        if (onResult) {
          onResult(null);
        }
        continue ;
      }

      /*
        run the predictions
      */
      const dataWriteStream = fs.createWriteStream(
        path.join(workdir, "data.txt"), {
          flags: 'w',
        }
      );

      debug("writing those records to disk");
      for (const row of history) {
        const ts = Math.round(row["ts"].getTime() / 1000); // round each timestamp to the nearest second
        dataWriteStream.write(ts + " " + row["spotprice"].toPrecision(6) + "\n");
      }

      dataWriteStream.end();
      await promisifyEvent(dataWriteStream, "close");
      debug("flushed the data to disk, ready to process data with sip-processor");

      // Now that the data is flushed out to the disk, we are ready to process it
      const cmdargs = [
        "./shellscripts/predict.sh",
        workdir, binpath,
        quant, conf,
        1 - quant, 1 - conf,
        350 /* bmbp_ts interval param TODO: make this configurable */,];
      debug("running sh %o", cmdargs);
      await runExecutableHelper("sh", cmdargs);

      const pgraphData = parsePGraph(
        (await fs.readFile(path.join(workdir, "graph.pgraph"))).toString()
      );
      debug("pgraph contained %o data points", pgraphData.length);

      if (pgraphData.length === 0) {
        console.log("DUMPING PGRAPH FOR INSPECTION:");
        console.log((await fs.readFile(path.join(workdir, "graph.pgraph"))).toString())
        console.log("\n\nDUMPING AGG.txt FOR INSPECTION");
        console.log((await fs.readFile(path.join(workdir, "agg.txt"))).toString())
        console.log("\n\nDUMPING PRED.txt FOR INSPECTION");
        console.log((await fs.readFile(path.join(workdir, "pred.txt"))).toString())
        continue ;
      }

      /*
        done running predictions
      */

      if (onResult) {
        onResult(pgraphData);
      }
      
      pgraphs.push({
        interval: {start, stop},
        pgraph: pgraphData,
      });
    }

    return pgraphs;
  });
}

module.exports = {
  getPGraph,
  getPGraphForTimes,
  getPGraphAdv,
}
