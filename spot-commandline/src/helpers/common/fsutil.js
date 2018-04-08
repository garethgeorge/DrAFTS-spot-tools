const path = require("path");
const uuidv4 = require("uuid/v4");
const fs = require("async-file");

const withTempDir = async (workdir, callback) => {
  const tempdir = path.join(workdir, uuidv4());
  try {
    await fs.mkdir(tempdir);
    return await callback(tempdir);
  } finally {
    await fs.rimraf(tempdir);
  }
}

module.exports = {
  withTempDir
}