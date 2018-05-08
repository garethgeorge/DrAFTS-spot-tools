import json
import gzip
import os
from collections import namedtuple 
from tqdm import tqdm 
import itertools
import numpy as np
import matplotlib.pyplot as plt

base_dir = '/Users/alpha/Coding/RACELab-Data/spot_data/before_and_after/'

before_dir = base_dir + 'before'
after_dir = base_dir + 'after'

errorMessages = []

def load_dataset(dir):
    global errorMessages 

    resultSet = {}

    for file in tqdm(list(os.listdir(dir))):
        if file.endswith(".json.gz"):
            with gzip.open(os.path.join(dir, file), "r") as f:
                data = json.load(f)

                resultObj = {
                    "intervals": 0,
                    "terminations": 0,
                    "samples": 0,
                }

                for result in data["results"]:
                    if "error" in result:
                        errorMessages.append(
                            (os.path.join(dir, file), result["error"])
                        )

                        continue 
                    # print(os.path.join(dir, file) + " - " + str(result["terminations"]))
                    resultObj["intervals"] += 1
                    resultObj["samples"] += len(result["samples"])
                    resultObj["terminations"] += result["terminations"]
                
                args = data["args"]
                resultSet[(args["region"], args["az"], args["insttype"], args["duration"])] = resultObj

    return resultSet

dsBefore = load_dataset(before_dir)
dsAfter = load_dataset(after_dir)

ResultKey = namedtuple("ResultKey", "region az insttype duration")
ResultPair = namedtuple("ResultPair", "key before after")

results = []

for key, afterResult in tqdm(list(dsAfter.items())):
    if key in dsBefore:
        (region, az, insttype, duration) = key
        partialKey = key[0:3]
        
        beforeResult = dsBefore[key]

        if beforeResult["samples"] == 0 or afterResult["samples"] == 0: continue 

        resultPair = ResultPair(ResultKey(*key), before=beforeResult, after=afterResult)
        results.append(resultPair)

        if resultPair.key.duration == 720:
            print(resultPair)

    else:
        print("no corresponding record for " + str(key))



def groupByRegionAzInstType(obj):
    return obj.key[0:3]

def groupByDuration(obj):
    return obj.key.duration

#
# PLOT BY DURATION
#
durations = []
slasBefore = []
slasAfter = []

for duration, results in itertools.groupby(sorted(results, key=groupByDuration), groupByDuration):
    print("DURATION: %d" % duration)

    avgSLABeforeTotal = 0.0
    avgSLABeforeCount = 0.0
    avgSLAAfterTotal = 0.0
    avgSLAAfterCount = 0.0
    for result in results:
        avgSLABeforeTotal += float(result.before["terminations"]) / float(result.before["samples"])
        avgSLAAfterTotal += float(result.after["terminations"]) / float(result.after["samples"])
        avgSLABeforeCount += 1
        avgSLAAfterCount += 1
    print("\tPERCENT SUCCESSFULLY FINISHED (1-terminations): before %f vs after %f" % (1 - avgSLABeforeTotal / avgSLABeforeCount, 1 - avgSLAAfterTotal / avgSLAAfterCount))
    durations.append(duration)
    slasBefore.append(1 - avgSLABeforeTotal / avgSLABeforeCount)
    slasAfter.append(1 - avgSLAAfterTotal / avgSLAAfterCount)

fig, ax1 = plt.subplots()
color = 'tab:red'
ax1.set_xlabel('duration (hours)')
ax1.set_ylabel('percentage finished', color=color)
ax1.plot(durations, slasBefore, color=color)
ax1.tick_params(axis='y', labelcolor=color)
color = 'tab:blue'
ax1.plot(durations, slasAfter, color=color)
fig.tight_layout()  # otherwise the right y-label is slightly clipped
plt.savefig("sla-by-duration.svg")


print("----------------------")
print("ERROR MESSAGES")

errorMessages.sort(key=lambda x:x[1])

for message, group in itertools.groupby(errorMessages, lambda x: x[1]):
    paths = list(map(lambda x:x[0], group))
    print(message + " x" + str(len(paths)))
    for path in paths:
        print("\t- " + path)
