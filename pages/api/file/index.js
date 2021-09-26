import {
  RESPOND,
  ERROR,
  getUserIdFromToken,
  MULTIPART,
  THUMBNAIL,
  DELETE,
  SCREENSHOT,
} from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery
import S3UPLOAD from '../../../lib/S3AWS';

const QTS = {
  // Query TemplateS
  getMIUI: 'getMemberByIdAndUserId',
  newFile: 'newFile',
  getFBI: 'getFileById',
};

export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  // #1. cors 해제
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*', // for same origin policy
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'], // for application/json
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  // #2. preflight 처리
  if (req.method === 'OPTIONS') return RESPOND(res, {});

  setBaseURL('sqls/file/file'); // 끝에 슬래시 붙이지 마시오.

  // #3.1
  if (req.method === 'GET') {
    try {
      return await get(req, res);
    } catch (e) {
      return ERROR(res, {
        id: 'ERR.school.index.3.1',
        message: 'server logic error',
        error: e.toString(),
      });
    }
  }

  // #3.2.1. multipart processing
  // multipart/form-data를 parse하여 req.body를 만들어 준다.
  // 파일은 ./public/tmp에 임시저장한다.
  const qMp = await MULTIPART(req);
  if (qMp.type === 'error')
    return ERROR(res, {
      id: 'ERR.school.index.3.2.1',
      message: qMp.message,
      eStr: qMp.eStr,
    });

  // #3.2.2. post action
  try {
    return await post(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.school.index.3.2.2',
      message: 'post server logic error',
      error: e.toString(),
    });
  }
}
async function get(req, res) {
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;
  return RESPOND(res, {
    userId,
    message: 'get 프로필 이미지 변경 성공',
    resultCode: 200,
  });
}
async function post(req, res) {
  // #3.0. 파일이 있는지 확인하고 없으면 리턴한다.
  const { member_id: memberId, index, file } = req.body;
  if (!file)
    return ERROR(res, {
      resultCode: 400,
      id: 'ERR.school.school.3.1.1',
      message: '처리할 파일이 존재하지 않습니다.',
    });

  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const { tmpName: fileName } = file;
  const isImage = file.mimetype.includes('image/');
  const isVideo = file.mimetype.includes('video/');

  // #3.1.2. member 검색
  const qMIUI = await QTS.getMIUI.fQuery({ userId, memberId });
  if (qMIUI.type === 'error')
    return qMIUI.onError(res, '3.1.2.1', 'searching member');
  if (qMIUI.message.rows.length === 0)
    return ERROR(res, {
      resultCode: 400,
      id: 'ERR.school.school.3.2.2',
      message: '토큰의 userId와 일치하는 member를 찾을 수 없습니다.',
    });

  // 이미지/동영상의 경우
  let thumbFileName;
  let duration = 0;
  if (isImage || isVideo) {
    // #3.2.1. thumbnail 생성
    const qThumb = isImage
      ? await THUMBNAIL(fileName)
      : await SCREENSHOT(fileName);
    if (qThumb.type === 'error')
      return ERROR(res, {
        resultCode: 400,
        id: 'ERR.school.school.3.2.1.1',
        message: qThumb.message,
        eStr: qThumb.eStr,
      });
    thumbFileName = qThumb.message.thumbName;
    if (isVideo) duration = qThumb.message.duration;
  }

  // #3.2.2. file upload
  const qUpload = await S3UPLOAD(fileName, 'lulla');
  if (qUpload.type === 'error')
    return ERROR(res, {
      resultCode: 400,
      id: 'ERR.school.school.3.2.2.1',
      message: qUpload.message,
      eStr: qUpload.eStr,
    });
  const s3Data = qUpload.message;

  // 이미지/동영상의 경우
  // #3.2.3. thumbnail upload
  let s3ThumbData;
  if (isImage || isVideo) {
    const qThumbUpload = await S3UPLOAD(thumbFileName, 'thumb');
    if (qThumbUpload.type === 'error')
      return ERROR(res, {
        resultCode: 400,
        id: 'ERR.school.school.3.2.3.1',
        message: qThumbUpload.message,
        eStr: qThumbUpload.eStr,
      });
    s3ThumbData = qThumbUpload.message;
  }

  // #3.2.4. delete file from local
  DELETE(fileName);
  // 이미지/동영상의 경우
  if (isImage || isVideo) DELETE(thumbFileName);

  // #3.3. file 테이블에 저장
  const qFile = await QTS.newFile.fQuery({
    fileName: file.tmpName,
    type: file.mimetype.split('/')[0],
    address: s3Data.Location,
    size: file.size,
    thumbnail_address: isImage || isVideo ? s3ThumbData.Location : null,
    key: s3Data.Key,
    width: isImage ? file.width : 0,
    height: isImage ? file.height : 0,
    index: !index ? 0 : index,
    duration: !duration ? 0 : duration,
  });
  if (qFile.type === 'error')
    return qFile.onError(res, '3.3.1', 'creating file');
  const fileId = qFile.message.rows[0].id;

  // #3.4. 저장한 file 가져오기
  const qFBI = await QTS.getFBI.fQuery({ fileId });
  if (qFBI.type === 'error')
    return qFBI.onError(res, '3.4.1', 'searching file');
  const data = qFBI.message.rows[0];

  return RESPOND(res, {
    s3Data,
    s3ThumbData,
    data,
    message: '파일 업로드 성공',
    resultCode: 200,
  });
}
