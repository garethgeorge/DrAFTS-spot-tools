w# Directions

## Setup
Yarn is the recommended package manager, but npm will also work
```
yarn install
```
to install dependencies

## Usage

**before running any experiments you must cache AWS data with bin/fetch.js**

Fetch all the data for a given region and time range, and store it in the database
```
node bin/fetch.js us-east-2 20180101-20180405
```

If you already have some data cached, you can update it with
```
node bin/update.js us-east-2
```
to pull all changes since the last record recorded in the database.

**generating a pgraph file**

the following is an example of the command to generate a pgraph file
 * the time range is the range of dates provided to the algorithm,
 * the conf is the confidence parameter passed to bmbp_ts
 * the quant parameter is the quantile parameter passed to bmbp_ts
 * ../bin is the path to the directory containing the binaries for sip-processor
```
node bin/predict.js us-east-1 us-east-1d x1e.8xlarge 20180101-20180405 --conf 0.01 --quant 0.975 --binpath ../bin
```

**run an experiment**
```
node bin/experiment.js us-east-1 us-east-1d x1e.8xlarge --binpath ../bin --conf 0.01 --quant 0.6 --cycleCount 200 --duration 4
```

**other useful commands**

search the results set for termination counts by file
```
cd results
ack "\"terminations\""
```

# Good Experiment Candidates
 - r4.large
 - 
