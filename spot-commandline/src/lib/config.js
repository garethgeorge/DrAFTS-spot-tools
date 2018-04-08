const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const debug = require('debug')('lib.config');

debug("loading config");

const config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "../../config.yml"), 'utf8'));

if (fs.existsSync("./locations.json")) {
  debug("loading locations.json");
  config.locations = JSON.parse(fs.readFileSync("./locations.json"));
}

debug("done.");

module.exports = config;