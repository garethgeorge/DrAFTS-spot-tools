module.exports = async function(jobs) {
  return new Promise((resolve, reject) => {
    let remaining = jobs.length;
    const results = new Array(jobs.length);

    jobs.forEach((job, idx) => {
      job.then((result) => {
        results[idx] = result;
        remaining--;
        if (remaining == 0) {
          resolve(results);
        }
      }).catch(reject);
    });
  })
}