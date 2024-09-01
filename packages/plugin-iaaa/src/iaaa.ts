import { createHash } from 'node:crypto'

export interface IAAAUserInfo {
  /**
   * @example '张子苏'
   */
  name: string
  /**
   * @example '开通'
   */
  status: string
  /**
   * @example '2100066233'
   */
  identityId: string
  /**
   * @example '00048'
   */
  deptId: string
  /**
   * @example '信息科学技术学院'
   */
  dept: string
  /**
   * @example '学生'
   */
  identityType: string
  /**
   * @example '本专科学生'
   */
  detailType: string
  /**
   * @example '在校'
   */
  identityStatus: string
  /**
   * @example '燕园'
   */
  campus: string
}

export interface IAAAValidateResponse {
  success: boolean
  /**
   * @example '0'
   */
  errCode: string
  /**
   * @example '认证成功'
   */
  errMsg: string
  userInfo: IAAAUserInfo
}

function md5(msg: string) {
  const hash = createHash('md5')
  hash.update(msg)
  return hash.digest('hex')
}

export async function validate(
  endpoint: string,
  remoteAddr: string,
  appId: string,
  appKey: string,
  token: string
) {
  const payload = `appId=${appId}&remoteAddr=${remoteAddr}&token=${token}`
  const sign = md5(payload + appKey)
  const resp = await fetch(`${endpoint}?${payload}&msgAbs=${sign}`)
  const data = <IAAAValidateResponse>await resp.json()
  return data
}
