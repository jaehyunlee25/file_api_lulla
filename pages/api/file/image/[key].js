import { RESPOND, ERROR } from '../../../../lib/apiCommon';
import setBaseURL from '../../../../lib/pgConn'; // include String.prototype.fQuery
import { S3GET } from '../../../../lib/S3AWS';

const QTS = {
  // Query TemplateS
  getFile: 'getFileById',
};

export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  // #1. cors 해제
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*', // for same origin policy
    'Content-Type': 'image',
    'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'], // for application/json
    'Access-Control-Allow-Methods': 'GET',
  });
  // #2. preflight 처리
  if (req.method === 'OPTIONS') return RESPOND(res, {});

  setBaseURL('sqls/file/image/key'); // 끝에 슬래시 붙이지 마시오.

  // #3.1
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.school.index.3.1',
      message: 'server logic error',
      error: e.toString(),
    });
  }
}
async function main(req, res) {
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  // const qUserId = await getUserIdFromToken(req.headers.authorization);
  // if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  // const userId = qUserId.message;
  const { key: fileId } = req.query;

  // #3.2. 이미지 정보를 가져온다.
  const qImage = await QTS.getFile.fQuery({ fileId });
  if (qImage.type === 'error')
    return qImage.onError(res, '3.2.1', 'searching image file');
  const file = qImage.message.rows[0];

  // #3.3.
  const qS3 = await S3GET(file.key);
  if (qS3.type === 'error') return ERROR(res, qS3);
  const con = qS3.message;

  return res.end(con.Body);
}
