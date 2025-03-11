require('dotenv').config();
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const path = require('path');
const apiRouters = require('./routes/apiRouters');

const app = new Koa();

app.use(serve(path.join(__dirname, 'public')));

app.use(bodyParser());

app.use(apiRouters.routes()).use(apiRouters.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
