module.exports = async function(jobs) {
  return new Promise((accept, rejectAll) => {
    let remaining = jobs.length;
    for (const job of jobs) {
      (async () => {
        try {
          await job();
          remaining--;
          if (remaining === 0) {
            accept();
          }
        } catch (e) {
          rejectAll();
          rejectAll = () => {}
        }
      })();
    }
  });
}