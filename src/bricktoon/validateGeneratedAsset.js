const fs = require("fs");

function validateGeneratedAsset(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, reason: "file missing" };
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size <= 0) {
    return { valid: false, reason: "file empty" };
  }
  return { valid: true };
}

module.exports = {
  validateGeneratedAsset
};
