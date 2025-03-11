const response = {
    success(ctx, data, statusCode = 200) {
        ctx.status = statusCode;
        ctx.body = {
            code: statusCode,
            success: true,
            data: "data" in data ? data.data : data,
        };
    },

    error(ctx, data, statusCode = 500) {
        ctx.status = statusCode;
        ctx.body = {
            code: statusCode,
            success: false,
            data: "data" in data ? data.data : data,
        };
    }
};

module.exports = response;