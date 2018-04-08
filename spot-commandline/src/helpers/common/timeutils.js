function parseTime(str) {
  if(!/^(\d){8}$/.test(str)) return "invalid date";
  var y = str.substr(0,4),
      m = str.substr(4,2) - 1,
      d = str.substr(6,2);
  return new Date(y,m,d);
}

function parseTimeRange(daterange) {
  try {
    const segments = daterange.split("-");
    return {
      start: parseTime(segments[0]),
      end: parseTime(segments[1])
    }
  } catch (e) {
    throw new Error("failed to parse the time range");
  }
}

module.exports = {
  parseTime,
  parseTimeRange,
}