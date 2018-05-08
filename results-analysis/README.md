### Identify Intervals
before the api change 
```
python identify-intervals.py <status info> --end "2017-11-01 00:00:00"
python results-analysis/identify-intervals.py ~/Coding/RACELab-Data/spot_data/us-east-1-status.txt --threshold 30 > ~/Coding/RACELab-Data/spot_data/us-east-1-intervallist.txt --end "2017-12-01 00:00:00"
```
after the change (skipping november as the change happened sometime in this month)
```
python identify-intervals.py <status info> --begin "2017-12-01 00:00:00"
python results-analysis/identify-intervals.py ~/Coding/RACELab-Data/spot_data/us-east-1-status.txt --threshold 30 > ~/Coding/RACELab-Data/spot_data/us-east-1-intervallist.txt --begin "2017-12-01 00:00:00"
```
