const debug = require("debug")("helpers.fetch.fetcher");

const HistoryRecord = require("../common/history_record");
const {Spinner} = require("cli-spinner")

const {format} = require('../../lib/db');
const {expect1row} = require('../common/queryutils');

const QUERY_GET_OLDEST_RECORD = `
SELECT * 
FROM history 
WHERE az = %L AND ts IN (
  SELECT MIN(ts) 
  FROM history
  WHERE az = %L
)
`

const QUERY_GET_NEWEST_RECORD = `
SELECT * 
FROM history 
WHERE az = %L AND ts IN (
  SELECT MAX(ts) 
  FROM history
  WHERE az = %L
)
`;

const QUERY_GET_SPOTPRICE_FOR_TIME = `
SELECT * 
FROM history 
WHERE az = %L AND ts IN (
  SELECT MAX(ts) 
  FROM history
  WHERE az = %L AND ts <= %L AND insttype = %L
) AND insttype = %L
`;

const QUERY_INSERT_HISTORY = `
INSERT INTO history (region, az, insttype, ts, spotprice)
VALUES %L
ON CONFLICT (region, az, insttype, ts) DO UPDATE
SET spotprice = excluded.spotprice;
`;


const QUERY_GET_HISTORY_RECORDS_IN_INTERVAL = `
SELECT COUNT(*) AS count 
FROM history 
WHERE az = %L AND insttype = %L AND ts >= %L and ts < %L
`;

class Fetcher {
  constructor(db, ec2, azname) {
    debug("instantiated a Fetcher(%o, %o, %o)", 
      db._connectionString, ec2.getRegion(), azname);
    this._azname = azname;
    this._ec2 = ec2;
    this._db = db;
  }

  async insertHistory(db, records) {
    const region = this._ec2.getRegion();
    const az = this._azname;
    debug("db.insertHistory(%s, %s, %d:records)", region, az, records.length);
    const query = format(
      QUERY_INSERT_HISTORY,
      records.map((obj, index) => {
        return [region, az, obj["InstanceType"], obj["Timestamp"], obj["SpotPrice"]]
      })
    );
    return await db.query(query);
  }
  
  async getOldestHistoryRecord() {
    return HistoryRecord.fromQuery(await expect1row(this._db.query(
      format(QUERY_GET_OLDEST_RECORD, this._azname, this._azname)
    )));
  }

  async getNewestHistoryRecord() {
    return HistoryRecord.fromQuery(await expect1row(this._db.query(
      format(QUERY_GET_NEWEST_RECORD, this._azname, this._azname)
    )));
  }

  async debugGetHistoryRecordsInInterval(insttype, start, stop) {
    return (await expect1row(this._db.query(
      format(QUERY_GET_HISTORY_RECORDS_IN_INTERVAL, this._azname, insttype,  start, stop)
    ))).count;
  }
  

  async getSpotPriceForTime(time, insttype) {
    return HistoryRecord.fromQuery(await expect1row(this._db.query(
      format(QUERY_GET_SPOTPRICE_FOR_TIME, this._azname, this._azname, time, insttype, insttype)
    )))
  }

  async fetchTimeRangeFromDB(start, end, insttype) {
    return HistoryRecord.fromQueryResults(
      (await this._db.query(format(`
        SELECT * 
        FROM history
        WHERE region = %L AND az = %L AND insttype = %L AND ts >= %L AND ts < %L
        ORDER BY ts 
      `, this._ec2.getRegion(), this._azname, insttype, start, end))).rows
    );
  }

  async fetchTimeRange(start, end, onProgress=() => {}) {
    debug("fetching time range %o - %o", start, end);

    return await this._db.transactionWith(async (transaction) => {
      return await new Promise((accept, reject) => {
        let pageno = 0;
        let recordcount = 0;

        this._ec2.getSpotPriceHistory(start, end, this._azname)
        .eachPage((err, data, done) => {
          if (err)
            return reject(err);
          
          if (data === null) {
            return accept(recordcount);
          }

          if (data.SpotPriceHistory.length > 0) {
            debug("%o %o got pageno %d time range: %o - %o", 
              this._ec2.getRegion(), this._azname, 
              pageno++, data.SpotPriceHistory[0].Timestamp, 
              data.SpotPriceHistory[data.SpotPriceHistory.length - 1].Timestamp);
            
            this.insertHistory(transaction, data.SpotPriceHistory)
              .then((insertResult) => {
                debug("\t%d rows inserted", insertResult.rowCount);
                recordcount += insertResult.rowCount;
                
                onProgress(pageno - 1, data.SpotPriceHistory);
                
                done();
              })
              .catch((err) => {
                console.log("ENCOUNTERED ERROR!!!!");
                console.log(err);
                done(err);
              });
          } else {
            debug("no spot price history was returned for page %d", pageno++);
            done();
          }
        })
      })
    });
  }

  /**
   * fetch the gap days since the last time the data was fetched from AWS
   * @arg showprogress - for interactive use we provide a progress bar to provide some measure of status
   * TODO: abstract 'showprogress' to a progress function so that it can be shared with the restful API for this service
   */
  async update(onProgress=(() => {})) { // 
    let newest = await this.getNewestHistoryRecord();
    if (!newest)
      throw new Error("Error! There are no history records available for az '" + this._azname + "', as such a 'update' is not a valid operation.");
    newest = newest.Timestamp;
    newest.setDate(newest.getDate() - 1); // fetch 1 day of overlap for safety's sake!

    const start = newest;
    const end = new Date();

    debug("fetching the gap for location: %o %o over time range: %o-%o", 
      this._ec2.getRegion(), 
      this._azname, 
      start, 
      end);
    
    return await this.fetchTimeRange(start, end, onProgress);
  }

  async fetchBacklog(days, onProgress=() => {}) {
    let oldest = await this.getOldestHistoryRecord();
    if (oldest) {
      oldest = oldest.Timestamp;
    } else 
      oldest = new Date;
    
    const startTime = new Date(oldest);
    startTime.setDate(startTime.getDate() - days);
    

    const start = startTime;
    const end = oldest;

    // okay now we actually trigger the fetch
    return await this.fetchTimeRange(start, end, onProgress);
  }
}

module.exports = Fetcher;