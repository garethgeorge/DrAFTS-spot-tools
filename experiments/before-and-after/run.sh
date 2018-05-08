REGION=us-east-1
SAMPLES=100
AZ=us-east-1a
CONF=0.5
QUANT=0.975

INSTANCE_TYPE_LIST=/spot_data/us-east-1a-20-random-instance-types.txt
RESULTS_DIR=/spot_data/before_and_after/after
MAX_SUB_PROCESSES=4

mkdir -p $RESULTS_DIR


# internal
SPOT_COMMAND_LINE=/drafts/DrAFTS-spot-tools/spot-commandline
DURATIONS='2 4 12 24 72 168 720'

run() {
    # cd into the root of DrAFTS-spot-tools/spot-commandline
    cd $SPOT_COMMAND_LINE 

    echo "Begin processing"

    for insttype in $(cat $INSTANCE_TYPE_LIST); do
        echo "\n\n\nProcessing Instance Type: $insttype"

        for duration in $DURATIONS; do
            echo "\nRunning experiment with duration setting: $duration"
            OUTPUT_FILE="$RESULTS_DIR/$REGION-$AZ-$insttype-d$duration-c$CONF-q$QUANT.json.gz"
            echo "\tOUTPUT FILE: $OUTPUT_FILE"
            echo "\tDURATION: $duration"
            echo "\tCONF: $CONF"
            echo "\tQUANT: $QUANT"
            echo "\tSAMPLES: $SAMPLES"

            if [ -f $OUTPUT_FILE ]; then 
                echo "\t\tskipping, output file already exists!"
            else 
                node bin/experiment-v2.js \
                    --region $REGION \
                    --az $AZ \
                    --insttype $insttype \
                    --samples $SAMPLES \
                    --duration $duration \
                    --conf $CONF \
                    --quant $QUANT \
                    --outputFile $OUTPUT_FILE \
                    --includePGraph \
                    /spot_data/us-east-1-intervallist-after-change.txt 2>&1 > $OUTPUT_FILE.log &
            fi

            num_children=`ps --no-headers -o pid --ppid=$$ | wc -w`
            while [ $num_children -gt $MAX_SUB_PROCESSES ]; do 
                num_children=`ps --no-headers -o pid --ppid=$$ | wc -w`
                sleep 1
            done
        done
    done
}

run