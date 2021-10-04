import { RESPOND, ERROR, getUserIdFromToken } from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery
import { S3DELETE } from '../../../lib/S3AWS';

const QTS = {
  // Query TemplateS
  getFBI: 'getFilesByIds',
  getDFBI: 'delFilesByIds',
};

// export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  // #1. cors 해제
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*', // for same origin policy
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'], // for application/json
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  // #2. preflight 처리
  if (req.method === 'OPTIONS') return RESPOND(res, {});

  setBaseURL('sqls/file/delete'); // 끝에 슬래시 붙이지 마시오.

  // #3.2.2. post action
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.school.index.3.2.2',
      message: 'post server logic error',
      error: e.toString(),
    });
  }
}
async function main(req, res) {
  // #3.0. 파일이 있는지 확인하고 없으면 리턴한다.

  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.

  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  // const userId = qUserId.message;

  let { id: fileId } = req.body.file;
  console.log(req.body.file);
  // #3.1.2. fileId는 배열이어야 한다.
  if (Array.isArray(fileId)) fileId = fileId.join("','");
  fileId = ["'", fileId, "'"].join('');

  console.log(fileId);

  // #3.2. 파일 목록을 불러온다.
  const qFiles = await QTS.getFBI.fQuery({ fileId });
  if (qFiles.type === 'error')
    return qFiles.onError(res, '3.2', 'searching files');

  // #3.3.
  qFiles.message.rows.forEach(async (file) => {
    const qDel = await S3DELETE(file.key);
    if (qDel.type === 'error')
      return ERROR(res, {
        id: 'ERR.file.delete.3.3',
        message: qDel.message,
        eStr: qDel.eStr,
      });
    console.log(qDel);

    const qDelThumb = await S3DELETE(file.key.replace('lulla', 'thumb'));
    if (qDelThumb.type === 'error')
      return ERROR(res, {
        id: 'ERR.file.delete.3.3',
        message: qDelThumb.message,
        eStr: qDelThumb.eStr,
      });
    console.log(qDelThumb);

    return true;
  });

  // #3.4. 파일 삭제
  const qFileDel = await QTS.getDFBI.fQuery({ fileId });
  if (qFileDel.type === 'error')
    return qFileDel.onError(res, '3.4', 'searching files');

  return RESPOND(res, {
    // data,
    message: '파일 삭제 성공',
    resultCode: 200,
  });
}
