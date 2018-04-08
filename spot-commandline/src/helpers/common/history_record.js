class HistoryRecord {
  constructor(region, az, insttype, ts, spotprice) {
    this.Region = region.trimRight();
    this.AvailabilityZone = az.trimRight();
    this.InstanceType = insttype.trimRight();
    this.Timestamp = ts;
    this.SpotPrice = spotprice;
  }

  static fromQuery(row, region=null, az=null) {
    if (row == null) 
      return null;
    return new HistoryRecord(row.region || region, row.az || az, row.insttype, row.ts, row.spotprice);
  }

  static fromQueryResults(array, region=null, az=null) {
    if (region == null && az == null)
      return array.map(HistoryRecord.fromQuery);
    else 
      return array.map((row) => {
        return HistoryRecord.fromQuery(row, region, az);
      });
  }
}

module.exports = HistoryRecord;