const fs = require("fs").promises;
const path = require("path");

async function run() {
  const filePath = path.join(
    __dirname,
    "..",
    "data",
    "criminal",
    "criminal.json",
  );
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw || "[]");
  let changed = 0;
  for (const obj of data) {
    if (Object.prototype.hasOwnProperty.call(obj, "district_id_of_criminal")) {
      const val = obj["district_id_of_criminal"];
      let newVal = val;
      if (typeof val === "string") {
        newVal = val.replace(/^DIST_/, "KA_");
      }
      obj["district_code_of_criminal"] = newVal;
      delete obj["district_id_of_criminal"];
      changed++;
    }
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Transformed ${changed} records in criminal.json`);
}

run().catch((err) => {
  console.error("Error transforming criminal.json", err);
  process.exit(1);
});
