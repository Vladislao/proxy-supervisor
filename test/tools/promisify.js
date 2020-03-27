module.exports = (fun, args, ctx) => {
  return new Promise((resolve, reject) => {
    args.push((err, data) => {
      err && reject(err);
      resolve(data);
    });
    fun.apply(ctx, args);
  });
};
