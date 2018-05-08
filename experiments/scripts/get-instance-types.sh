# takes machine status as an input and returns a list of instance types, irrespective of the az
STATUS_FILE=$1
cat $STATUS_FILE | grep us-east-1b | awk -F "\"*,\"*" '{print $3}' | sort | uniq 
