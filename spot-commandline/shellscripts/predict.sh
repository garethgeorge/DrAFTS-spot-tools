check()
{
    if (test -z "$1") ; then
        echo "predict.sh <WORKING_DRIECTORY> <BIN> <QUANTILE> <CONFIDENCE> <INVQUANT> <INVCONF> <INTERVAL>"
        exit 1
    fi
}

HERE=$1
BIN=$2
QUANT=$3
CONF=$4
INVQUANT=$5
INVCONF=$6
INTERVAL=$7

$BIN/spot-price-aggregate -f $HERE/data.txt | sort -n -k 1 -k 2 | uniq | awk '{if ($1 > 1422228412) {print $1,$2}}' > $HERE/agg.txt

# NOTE: this script may be run multiple times, in the same directory, but with different data.txt's to get new pgraph's out
if [ -e $HERE/bmbp.state ]
then 
    # $BIN/bmbp_ts -f $HERE/agg.txt -T -q 0.975 -c 0.01 --loadstate $HERE/bmbp.state.in --savestate $HERE/bmbp.state.out | grep "pred:" | awk '{print $2,$4,($6+0.0001),$14}' > $HERE/pred.txt
    $BIN/bmbp_ts -f $HERE/agg.txt -T -i $INTERVAL -q $QUANT -c $CONF --loadstate $HERE/bmbp.state --savestate $HERE/bmbp.state | grep "pred:" | awk '{print $2,$4,($6+0.0001),$14}' >> $HERE/pred.txt
else 
    # $BIN/bmbp_ts -f $HERE/agg.txt -T -q 0.975 -c 0.01 --savestate $HERE/bmbp.state.out | grep "pred:" | awk '{print $2,$4,($6+0.0001),$14}' > $HERE/pred.txt
    $BIN/bmbp_ts -f $HERE/agg.txt -T -i $INTERVAL -q $QUANT -c $CONF --savestate $HERE/bmbp.state | grep "pred:" | awk '{print $2,$4,($6+0.0001),$14}' >> $HERE/pred.txt
fi

# note, once these would have gone in the 'postprocess step' and may yet want to be moved back there
awk '{print $1,$2,$3}' $HERE/pred.txt > $HERE/temp.txt
$BIN/pred-distribution-fast -f $HERE/temp.txt -q $INVQUANT -c $INVCONF -F 4.0 -I 0.05 | awk '{print $1/3600,$2}' > $HERE/graph.pgraph