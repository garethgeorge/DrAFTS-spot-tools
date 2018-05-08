#! /bin/bash 
# DIR="/spot_data/rich_historical_data_extracted/full-us-west-*" 
# for filename in $DIR; do
#   echo "$filename"
#   node bin/import-data.js us-west-1 $filename 
# done 

DIR="/spot_data/rich_historical_data_extracted/full-us-east-*" 
for filename in $DIR; do
  echo "$filename"
  node bin/import-data.js us-east-1 $filename --parallelism 2
done 
