import argparse
import dateutil.parser # pip install python-dateutil 
from datetime import datetime

parser = argparse.ArgumentParser(description="given the ouptup of ./bin/status.js --full, identifies intervals of continuous times")
parser.add_argument("status_file", help="status file to load")

args = parser.parse_args()

def readJSDate(dateStr):
    return dateutil.parser.parse(dateStr)

with open(args.status_file, 'r') as f:
    rows = [tuple(val.strip() for val in line.split(",")) for line in f]
    intervals = []
    intervalBeginDate = {}
    lastDate = {}
    regionForAz = {}
    for region, az, date, recordCount in rows:
        date = readJSDate(date)
        if az not in regionForAz:
            regionForAz[az] = region 
        if az not in lastDate:
            lastDate[az] = date 
            intervalBeginDate[az] = date 
        elif (date - lastDate[az]).days != 1:
            # print("gap of %d days between consecutive data points for az %s" % ((date - lastDate[az]).days, az))
            intervals.append((region, az, intervalBeginDate[az], lastDate[az]))
            intervalBeginDate[az] = date 
            lastDate[az] = date 
        lastDate[az] = date

    for az, intervalBegin in intervalBeginDate.items():
        intervals.append((regionForAz[az], az, intervalBegin, lastDate[az]))
    
for region, az, start, stop in intervals:
   print("%s,%s,%s,%s" % (region, az, start.isoformat(), stop.isoformat())) 
