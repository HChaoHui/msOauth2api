function getRequestParams(req) {
  if (!req) {
    return {};
  }

  return req.method === 'GET' ? req.query || {} : req.body || {};
}

function isAdminAuthorized(params, env = process.env) {
  const expectedPassword = env.PASSWORD;

  if (!expectedPassword) {
    return true;
  }

  return params.password === expectedPassword;
}

module.exports = {
  getRequestParams,
  isAdminAuthorized,
};
