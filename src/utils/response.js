function success(data, message = 'success') {
  return {
    code: 0,
    message,
    data: data || null
  };
}

function error(code, message, data = null) {
  return {
    code,
    message,
    data
  };
}

module.exports = { success, error };
