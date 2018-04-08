## Experiment 1: c=0.5, q=0.975, samples=1000, duration=4

Regarding the termination counts, I found that on average the termination counts were close, within reason, to the requested SLA (less than or equal to 0.975% downtime), though it is certainly the case that many dropped below the requested SLA which is less than ideal.

In this experiment, out of the 1072 experiments run, 223 (20.80%) exhibited any terminations. THose with no terminations are omitted from the results.txt. I initially suspested that this might have been because there was too little variation (or no variation) over the sample window, but most dataests do seem to exhibit at least some change as shown by status.txt (generated by /spot-commandline/bin/status.js) which shows the min, max, and standard deviation of the data for each az / instance type in us-east-1. It may still be the case that the variations shown are too small, or are actually decreasing trends. I hope to perform further analysis.