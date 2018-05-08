import argparse
import dateutil.parser # pip install python-dateutil 
from datetime import datetime
import itertools
from collections import namedtuple
import sys

parser = argparse.ArgumentParser(description="given the ouptup of ./bin/status.js --full, identifies intervals of continuous times")
parser.add_argument("status_file", help="status file to load")
parser.add_argument("--threshold", help="number of days before we consider an interval to have been interrupted", type=int, default=7)
parser.add_argument("--begin", help="the start date", required=False)
parser.add_argument("--end", help="the start date", required=False)

args = parser.parse_args()

def readJSDate(dateStr):
    return dateutil.parser.parse(dateStr).replace(tzinfo=None)

if args.begin is not None:
    begin = readJSDate(args.begin)
    sys.stderr.write("args.begin = " + str(args.begin) + "\n")
else:
    begin = None 
    
if args.end is not None:
    end = readJSDate(args.end)
    sys.stderr.write("args.end = " + str(args.end) + "\n")
else:
    end = None

with open(args.status_file, 'r') as f:
    Row = namedtuple('Row', ['region', 'az', 'insttype', 'date', 'count'])
    Interval = namedtuple('Row', ['region', 'az', 'insttype', 'start', 'stop'])
    
    rows = []
    for line in f:
        if len(line.strip()) == 0: continue 

        segs = tuple(val.strip() for val in line.split(","))
        rows.append(Row(segs[0], segs[1], segs[2], readJSDate(segs[3]), segs[4]))
    rows.sort()

    for (region, az, insttype), group in itertools.groupby(rows, lambda row: (row.region, row.az, row.insttype)):
        while True:
            try: 
                last_row = next(group)
            except StopIteration as e:
                sys.stderr.write("skipping group (%s, %s, %s), no data points before 'begin'\n" % (region, az, insttype))
                break
            interval_start = last_row.date 

            if begin is not None and interval_start < begin:
                continue
            break 

        group = list(group)
        if len(group) == 0: continue 
        
        for row in group:
            if end is not None and row.date >= end:
                break 

            if (row.date - last_row.date).days > args.threshold:
                if (row.date - interval_start).days >= args.threshold:
                    sys.stdout.write(
                        "%s,%s,%s,%s,%s\n" % (
                            region, az, insttype, 
                            interval_start, last_row.date
                        )
                    )
                else:
                    sys.stderr.write("skipped interval because it was too short")
                interval_start = row.date 
            last_row = row
        if (last_row.date - interval_start).days >= args.threshold:
            sys.stdout.write(
                "%s,%s,%s,%s,%s\n" % (
                    region, az, insttype, 
                    interval_start, last_row.date
                )
            )