function parseTime(str) {
  if (str.toLowerCase() === "now") return new Date();
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

function addToTime(time, days=0, hours=0, minutes=0, seconds=0) {
  const timeInHours = days * 24 + hours;
  const timeInMinutes = timeInHours * 60 + minutes;
  const timeInSeconds = timeInMinutes * 60 + seconds;
  return new Date(time.getTime() + timeInSeconds * 1000);
}



module.exports = {
  parseTime,
  parseTimeRange, 
  addToTime,
}