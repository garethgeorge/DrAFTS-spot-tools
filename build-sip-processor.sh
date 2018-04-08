cd ./sip-processor/src/euca-cutils
make clean
make
cd ../pred-duration
make clean
make
cd ../spot-predictions 
make clean
make
cd ../../..
rm -rf ./bin
mkdir ./bin 
cp ./sip-processor/src/schmib_q/bmbp_ts ./bin/
cp ./sip-processor/src/pred-duration/pred-distribution ./bin/ 
