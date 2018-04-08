#! /bin/bash

cd spot-commandline

MAX_SUB_PROCESSES=4

get_num_children() {
    bash_pid=$$
    children=`ps -eo ppid | grep -w $bash_pid`
    num_children=`echo $children | wc -w`
}

run_experiment() {
    echo "Region: $REGION"
    echo "CONF: $CONF"
    echo "QUANT: $QUANT"
    echo "SAMPLES: $SAMPLES"
    echo "DURATION: $DURATION"

    for AZ in $( node bin/status.js $REGION); do
        echo "Processing availability zone $REGION:$AZ"

        for INSTTYPE in $( node bin/status.js $REGION --az $AZ | cut -d "," -f1); do 
            echo "Instance type is $INSTTYPE"
            
            PARAMS="q$QUANT-c$CONF-d$DURATION-x$SAMPLES"
            DIR="../results/${PARAMS}/${REGION}/${AZ}"
            BASENAME="${AZ}_${INSTTYPE}_${PARAMS}"
            FILE=$DIR/$BASENAME.json
            LOGFILE=$DIR/$BASENAME.log.txt
            mkdir -p $DIR

            if [ -f $FILE ]; then 
                echo "\t skipping! Results file $FILE already exists."
            else 
                echo "\t spawning worker process"
                node bin/experiment.js \
                    $REGION $AZ $INSTTYPE \
                    --binpath ../bin --conf $CONF \
                    --quant $QUANT --samples $SAMPLES \
                    --duration $DURATION \
                    --outputFile $FILE > $LOGFILE 2>&1 &
            fi
            
            get_num_children 
            while [ $num_children -gt $MAX_SUB_PROCESSES ]; do 
                get_num_children
                sleep 1
            done
        done
    done
}

# Configuration 1
CONF=0.5
QUANT=0.975
SAMPLES=1000
DURATION=4

REGION=us-east-1
run_experiment
REGION=us-west-1
run_experiment

# Configuration 2
REGION=us-east-1
CONF=0.01
QUANT=0.975
SAMPLES=1000
DURATION=4

REGION=us-east-1
run_experiment
REGION=us-west-1
run_experiment

# Configuration 3
CONF=0.5
QUANT=0.975
SAMPLES=1000
DURATION=16

REGION=us-east-1
run_experiment
REGION=us-west-1
run_experiment

# Configuration 4
REGION=us-east-1
CONF=0.01
QUANT=0.975
SAMPLES=1000
DURATION=16

REGION=us-east-1
run_experiment
REGION=us-west-1
run_experiment