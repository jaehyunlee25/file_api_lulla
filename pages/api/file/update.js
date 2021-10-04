import { RESPOND, ERROR, getUserIdFromToken } from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery

const QTS = {
  // Query TemplateS
  setFile: 'setFileById',
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

  setBaseURL('sqls/file/update'); // 끝에 슬래시 붙이지 마시오.

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

  let { file: files } = req.body;

  if (!Array.isArray(files)) files = [files];

  // #3.2. files는 배열이어야 한다.
  files.forEach(async (file, i) => {
    const { id, index } = file;
    const qUp = await QTS.setFile.fQuery({ id, index });
    if (qUp.type === 'error') return qUp.onError(res, '3.2', 'updating file');
    if (i === files.length - 1)
      return RESPOND(res, {
        message: '파일 수정에 성공하였습니다.',
        resultCode: 200,
      });
    return true;
  });

  return true;
}
