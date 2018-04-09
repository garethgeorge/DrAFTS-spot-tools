module.exports = async (list, operation) => {
  const results = [];
  for (const idx in list) {
    const value = list[idx];
    results.push(await operation(value, idx));
  }
  return results;
}