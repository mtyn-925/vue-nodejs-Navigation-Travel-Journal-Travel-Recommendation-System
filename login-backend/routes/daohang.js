const express = require('express');
const router = express.Router();

// 正确写法
router.get('/test', (req, res) => {
  console.log('✅ wangjiyu路由定义成功！');
  res.send('路由接口返回成功');
});

module.exports = router;
