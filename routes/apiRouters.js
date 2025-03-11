const Router = require('koa-router');
const mail_all = require('../api/mail-all');
const mail_new = require('../api/mail-new');
const process_inbox = require('../api/process-inbox');
const process_junk = require('../api/process-junk');
const send_mail = require('../api/send-mail');

const router = new Router({
  prefix: '/api'
});

router.get('/mail-all', mail_all);
router.get('/mail-new', mail_new);
router.get('/process-inbox', process_inbox);
router.get('/process-junk', process_junk);
router.get('/send-mail', send_mail);

module.exports = router;
