(function (global, factory) {
  const exports = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  }

  if (global) {
    global.MailImportUtils = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseEmailText(content, delimiter) {
    if (!content || !delimiter) {
      return [];
    }

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const fields = line.split(delimiter);

        if (fields.length < 4) {
          return null;
        }

        const [email, password, clientId, ...refreshTokenParts] = fields;
        const refreshToken = refreshTokenParts.join(delimiter).trim();
        const parsedRow = {
          email: email.trim(),
          password: password.trim(),
          clientId: clientId.trim(),
          refreshToken,
        };

        if (
          !parsedRow.email ||
          !parsedRow.password ||
          !parsedRow.clientId ||
          !parsedRow.refreshToken
        ) {
          return null;
        }

        return parsedRow;
      })
      .filter(Boolean);
  }

  return {
    parseEmailText,
  };
});
