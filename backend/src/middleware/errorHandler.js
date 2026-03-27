function errorHandler(err, req, res, next) {
  console.error(`[Error] RequestId=${req.requestId} ${err.message}`, err.stack);
  res.status(500).json({
    code: 50001,
    message: '服务器内部错误',
    data: null,
  });
}

module.exports = { errorHandler };
