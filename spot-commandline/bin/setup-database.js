const {db, format} = require("../src/lib/db");
const fs = require("fs");

(async () => {
  const data = fs.readFileSync("./database.sql").toString("ascii");

  let rejoined = "";
  for (const line of data.split("\n")) {
    if (line.trim().length === 0 && rejoined.length > 0) {
      console.log("running query:");
      console.log(rejoined);
      try {
        await db.query(rejoined);
      } catch (e) {
        console.log("error: ", e);
      }
      rejoined = "";
    } else 
      rejoined += line + "\n";
  }
  db.end();
})();