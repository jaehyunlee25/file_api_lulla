/* eslint-disable no-extend-native */
/* eslint-disable no-template-curly-in-string */
/* eslint-disable no-param-reassign */
/* eslint no-extend-native: ['error', { "exceptions": ["String"] }] */
import axios from 'axios';
import Thumbnail from 'image-thumbnail';
import sizeOf from 'image-size';
import fs from 'fs';
import Busboy from 'busboy';
import ffmpeg from 'fluent-ffmpeg';

const domains = {
  auth: process.env.url_auth_header,
  school: process.env.url_school_header,
};

String.prototype.proc = function proc(param) {
  let self = this;
  Object.keys(param).forEach((key) => {
    const regex = new RegExp('\\$\\{'.add(key).add('\\}'), 'g'); // 백슬래시 두 번,  잊지 말 것!!
    const val = param[key];
    self = self.replace(regex, val);
  });
  return self;
};
String.prototype.add = function add(str) {
  return [this, str].join('');
};
Array.prototype.lo = function lo() {
  const idx = this.length - 1;
  return this[idx];
};

const ADDR = process.env.tmp_file_path;

export async function POST(domain, addrs, header, param) {
  const config = {
    method: 'POST',
    url: [domains[domain], addrs].join(''),
    headers: header,
    data: param,
  };
  console.log(config);
  try {
    const result = await axios(config);
    console.log(result);
    if (result.data.type === 'error')
      return {
        type: 'error',
        onError: (res, id) => procError(res, id, '', result.data),
      };
    return { type: 'success', message: result.data };
  } catch (e) {
    return {
      type: 'error',
      onError: (res, id, message) => procError(res, id, e.toString(), message),
    };
  }
}
export async function SIZE(addr) {
  try {
    const result = await getSize();
    return { type: 'success', message: result };
  } catch (e) {
    return {
      type: 'error',
      message: 'getting image size fails',
      eStr: e.toString(),
    };
  }

  function getSize() {
    return new Promise((resolve, reject) => {
      sizeOf(addr, (err, result) => {
        if (err) reject(new Error(err));
        else resolve(result);
      });
    });
  }
}
export async function MULTIPART(req) {
  const param = {};
  let fileLen = 0;
  let filePending = false;

  try {
    const result = await multipart();
    return { type: 'success', message: result };
  } catch (e) {
    return { type: 'error', message: 'multipart error', eStr: e.toString() };
  }

  function multipart() {
    return new Promise((resolve, reject) => {
      let busboy;
      try {
        busboy = new Busboy({ headers: req.headers });
      } catch (e) {
        reject(e);
      }

      req.pipe(busboy);

      busboy.on('field', (fieldname, val) => {
        param[fieldname] = val;
      });
      busboy.on('finish', async () => {
        // finish는 field 순회가 끝나면 호출된다.
        // 때문에 file end에서 함수를 끝내는 게 더 낫다.
        // 다만 file이 없는 경우에는 무한대기할 가능성이 있다.
        req.body = param;
        if (!filePending) resolve();
      });
      busboy.on(
        'file',
        async (fieldname, file, filename, encoding, mimetype) => {
          // 임시저장할 때, 파일의 원래 이름이 겹칠 수 있으므로, 시간값을 포함해서, 유일값을 만든 뒤
          // 저장한다.
          filePending = true;
          const t = new Date().getTime();
          param[fieldname] = {
            tmpName: t.toString().add('_').add(filename),
            fileName: filename,
            encoding,
            mimetype,
          };
          const dest = ADDR.add(param[fieldname].tmpName);
          const wStream = fs.createWriteStream(dest);
          file.pipe(wStream);

          file.on('data', (data) => {
            fileLen += data.length;
          });
          file.on('end', async () => {
            if (param[fieldname].mimetype.includes('image')) {
              const size = await SIZE(dest);
              param[fieldname].width = size.message.width;
              param[fieldname].height = size.message.height;
              param[fieldname].type = size.message.type;
            }
            param[fieldname].size = fileLen;
            resolve();
          });
        },
      );
    });
  }
}
export async function DELETE(filename) {
  try {
    const full = ADDR.add(filename);
    fs.unlinkSync(full);
    return {
      type: 'success',
      message: 'image file deleted',
      target: full,
    };
  } catch (e) {
    return {
      type: 'error',
      message: 'delete image file fail',
      eStr: e.toString(),
    };
  }
}
export async function THUMBNAIL(filename) {
  const target = ADDR.add(filename);
  const thumbName = 'thumb_'.add(filename);
  const destination = ADDR.add(thumbName);

  try {
    const thumbnail = await Thumbnail(target, { width: 640 });
    const cws = fs.createWriteStream(destination);
    cws.write(thumbnail);
    cws.end();
    return { type: 'success', message: { thumbName } };
  } catch (e) {
    return {
      type: 'error',
      message: 'thumbnail creating fail',
      eStr: e.toString(),
    };
  }
}
export async function SCREENSHOT(filename) {
  const target = ADDR.add(filename);
  const thumbName = 'thumb_'.add(filename);
  const duration = await getVideoDuration();

  try {
    await capture();
    return { type: 'success', message: { thumbName, duration } };
  } catch (e) {
    return {
      type: 'error',
      message: 'screenshot creating fail',
      eStr: e.toString(),
    };
  }

  function capture() {
    return new Promise((resolve, reject) => {
      const con = ffmpeg(target);
      con.screenshots({
        count: 1,
        folder: ADDR,
        size: '320x240',
        filename: thumbName,
      });
      // con.on('filenames', (filenames) => {});  // 스크린샷 이름들이 배열로 출력된다.
      con.on('error', (err) => {
        reject(err);
      });
      con.on('end', () => {
        resolve();
      });
    });
  }
  function getVideoDuration() {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(target, (err, metadata) => {
        if (err) reject(new Error(err));
        resolve(metadata.format.duration);
      });
    });
  }
}
export async function getUserIdFromToken(Authorization) {
  // 토큰의 유효성을 점검한다.
  const strErr = {
    one: '인증 데이터가 올바르지 않습니다. 올바른 형식은 headers 에 Authorization : Bearer {token}입니다.',
    two: '유효하지 않은 토큰입니다. 재로그인 하여 토큰을 발급받아서 사용해주세요.',
  };
  const addrs = 'http://dev.lulla.co.kr/api/auth/getUserIdFromToken';
  if (!Authorization)
    return {
      type: 'error',
      onError: (res, id) => procError(res, id, '', strErr.one),
    };

  try {
    const result = await axios({
      method: 'GET',
      url: addrs,
      headers: { Authorization },
    });
    // console.log(result);
    // 토큰 유효성 에러
    if (result.data.type === 'error')
      return {
        type: 'error',
        onError: (res, id) => procError(res, id, '', result.data.message),
      };
    // 토큰 유효성 통과
    return { type: 'success', message: result.data.userId };
  } catch (e) {
    return {
      type: 'error',
      onError: (res, id) => procError(res, id, e.toString(), strErr.two),
    };
  }
}
export function RESPOND(res, param) {
  res.end(JSON.stringify(param));
}
export function ERROR(res, param) {
  param.type = 'error';
  param.resultCode = 400;
  res.end(JSON.stringify(param));
  return 'error';
}
function procError(res, id, eString, message) {
  const prm = {
    type: 'error',
    resultCode: 401,
    id: 'ERR'.add('user.token').add(id),
    name: eString,
    message,
  };
  res.end(JSON.stringify(prm));
  return 'error';
}
export function getRandom(start, end) {
  const amount = end - start;
  const rslt = Math.random() * (amount + 1) + start;
  return parseInt(rslt, 10);
}
