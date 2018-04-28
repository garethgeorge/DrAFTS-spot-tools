#! /bin/bash 
DIR="/dataset/full-us-west-1*" 
for filename in $DIR; do
  echo "$filename"
  node bin/import-data.js us-west-1 $filename 
done 

DIR="/dataset/full-us-east-1*" 
for filename in $DIR; do
  echo "$filename"
  node bin/import-data.js us-east-1 $filename 
done 
