import argparse 
import shutil 
import json
from os import path, walk

parser = argparse.ArgumentParser(description="provide statistics about the numbers of terminations encountered")

parser.add_argument("resultsDir", help="the directory to scan")

args = parser.parse_args()

errors = []
totalTerminations = 0
withTerminations = 0
withoutTerminations = 0
totalExperimentsCount = 0

for root, dirs, files in walk(args.resultsDir):
  for file in files:
    if not file.endswith(".json"): continue 

    full_path = path.join(root, file)
    with open(full_path, "r") as f:
      data = json.load(f)
      if "error" in data:
        errors.append(data["error"])
      elif "results" in data:
        theTerminations = data["results"]["terminations"]
        totalTerminations += theTerminations 
        totalExperimentsCount += len(data["results"]["samples"])

        if theTerminations > 0:
          print("%50s - %4d - SLA: %.4f" % (file, theTerminations, 1 - float(theTerminations) / data["results"]["args"]["samples"]))
          withTerminations += 1
        else:
          withoutTerminations += 1

print("portion of files with terminations: %d/%d = %.4f" % 
  (withTerminations,(withTerminations+withoutTerminations), 
  float(withTerminations)/(withTerminations+withoutTerminations)))

print("Average SLA quality: (%d/%d) = %.4f" % 
  (totalTerminations, totalExperimentsCount,
  1 - float(totalTerminations) / totalExperimentsCount)
)