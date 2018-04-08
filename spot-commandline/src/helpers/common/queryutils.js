const expect1row = async (promise) => {
  const result = await promise;
  if (result.rows.length === 0) {
    return null;
  } 
  return result.rows[0];
}


module.exports = {
  expect1row
}