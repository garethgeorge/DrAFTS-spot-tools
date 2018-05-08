module.exports = async function(jobs) {
  return new Promise((accept, reject) => {
    let remaining = jobs.length;
    let error = null;

    for (const job of jobs) {
      (async () => {
        try {
          await job();
          remaining--;
        } catch (e) {
          error = e;
          remaining--;
        } finally {
          if (remaining === 0) {
            if (!error) {
              accept();
            } else
              reject(error);
          }
        }
      })();
    }
  });
}