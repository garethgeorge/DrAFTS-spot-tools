const util = require('util');
const AWS = require('aws-sdk');
const debug = require("debug")("lib.aws");
class EC2 {
  constructor(region, accessKeyId, accessSecretKey) {
    this.region = region;
    this.ec2 = new AWS.EC2({
      "accessKeyId": accessKeyId,
      "secretAccessKey": accessSecretKey,
      "region": region,
    });
  }

  getRegion() {
    return this.region;
  }

  getSpotPriceHistory(startTime, endTime, az=null) {
    return this.ec2.describeSpotPriceHistory({
      "ProductDescriptions": ["Linux/UNIX"],
      "StartTime": startTime,
      "EndTime": endTime,
      "AvailabilityZone": az,
    })
  }

  async getSpotPriceHistoryArray(startTime, endTime, az=null) {
    return await new Promise((accept, reject) => {
      const list = [];
      let page = 1;
      this.getSpotPriceHistory(startTime, endTime, az).eachPage((err, data) => {
        if (err) {
          return reject(err);
        }
        if (data == null) {
          return accept(list);
        }
        list.push.apply(list, data.SpotPriceHistory);
      });
    })
  }

  async getSpotPriceHistoryArrayFiltered(startTime, endTime, az=null) {
    const startTs = startTime.getTime();
    const endTs = endTime.getTime();

    return (await this.getSpotPriceHistoryArray(startTime, endTime, az)).filter((result) => {
      const ts = result.Timestamp.getTime();
      return ts >= startTs && ts < endTs;
    });
  }

  async getRegions() {
    if (this.region_list) return this.region_list;

    const describeRegions = this.ec2.describeRegions();
    return this.region_list = (await util.promisify(describeRegions.send.bind(describeRegions))()).Regions.map((val) => {
      return val.RegionName;
    });
  }

  async getAvailabilityZones() {
    if (this.az_list) return this.az_list;
    debug("fetching AZ's");
    const describeAvailabilityZones = this.ec2.describeAvailabilityZones()
    return this.az_list = (
      await util.promisify(
        describeAvailabilityZones.send.bind(describeAvailabilityZones)
      )()
    ).AvailabilityZones.map((obj) => {
      return obj.ZoneName
    });
  }
}

module.exports = {
  EC2: EC2
}
