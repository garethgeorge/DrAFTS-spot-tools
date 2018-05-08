const debug = require("debug")("helpers.common.fsutil");
const path = require("path");
const uuidv4 = require("uuid/v4");
const fs = require("async-file");
const realFs = require("fs");

const withTempDir = async (workdir, callback) => {
  const tempdir = path.join(workdir, uuidv4());
  debug("making temporary directory %o in workdir %o", tempdir, workdir);
  try {
    realFs.mkdirSync(tempdir);
    return await callback(tempdir);
  } finally {
    await fs.rimraf(tempdir);
  }
}


async function *streamLineByLine(stream) {
  console.log("trying to iterate stream line by line!");
  let text = '';
  for await (let line of stream) {
    text += line;
    while (true) {
      const newLine = text.indexOf('\n');
      if (newLine !== -1) {
        yield text.substring(0, newLine);
      } else
         break 
      text = text.substring(newLine + 1);
    }
  }
}


module.exports = {
  withTempDir,
  streamLineByLine
}