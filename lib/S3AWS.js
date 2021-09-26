/* eslint-disable no-extend-native */
import aws from 'aws-sdk';
import fs from 'fs';

const ADDR = process.env.tmp_file_path;

aws.config.update({
  accessKeyId: process.env.aws_key,
  secretAccessKey: process.env.aws_private_key,
  region: process.env.aws_s3_region,
});

const s3 = new aws.S3();

function s3upload(addr, prefix) {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: process.env.aws_s3_bucket,
      Key: `${prefix}_${Date.now()}__${Math.floor(
        Math.random() * 10000,
      )}__.${addr.split('.').lo()}`,
      // ContentType: 'application/zip',
      Body: fs.readFileSync(addr),
    };
    s3.upload(params, (err, data) => {
      if (err) reject(new Error(err));
      else resolve(data);
    });
  });
}
export default async function S3UPLOAD(fileName, prefix) {
  const addr = ADDR.add(fileName);
  // prefix: lulla | thumb
  try {
    const result = await s3upload(addr, prefix);
    return { type: 'success', message: result };
  } catch (e) {
    return { type: 'error', message: 'fail to s3 upload', eStr: e.toString() };
  }
}
// eslint-disable-next-line func-names
Array.prototype.lo = function () {
  const len = this.length - 1;
  return this[len];
};
